import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { getStock } from '@/lib/warehouse'


export async function GET(_req: Request, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('delegates', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: {
        delegate: true,
        creator: true,
        settlement: true,
        items: { include: { product: true } },
        invoices: {
          include: { customer: true, items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!deliveryOrder) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 })
    }

    // الرصيد المتبقي على العربية لكل صنف = المحمّل - مجموع المسلّم في الفواتير المرتبطة
    const remaining = deliveryOrder.items.map((item) => {
      const delivered = deliveryOrder.invoices
        .flatMap((inv) => inv.items)
        .filter((invItem) => invItem.productId === item.productId)
        .reduce((sum, invItem) => sum + Number(invItem.quantity), 0)

      return {
        productId: item.productId,
        productName: item.product.name,
        loaded: item.quantity,
        delivered,
        remaining: Number(item.quantity) - delivered,
      }
    })

    return NextResponse.json({ ...deliveryOrder, remaining })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch delivery order' }, { status: 500 })
  }
}

// تعديل أمر التحميل — مسموح بس طول ما المندوب ماأكّدش الاستلام (لسه معلّق) والبضاعة لسه في المخزن
export async function PUT(req: Request, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('delegates', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth

  try {
    const order = await prisma.deliveryOrder.findUnique({ where: { id: params.id }, include: { delegate: true } })
    if (!order) return NextResponse.json({ error: 'أمر التحميل غير موجود' }, { status: 404 })
    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: 'مينفعش تعدّل أمر بعد ما المندوب أكّد الاستلام واتحرك' }, { status: 400 })
    }

    const body = await req.json()
    const items = Array.isArray(body.items) ? body.items.filter((i: any) => i.productId && Number(i.quantity) > 0) : []
    if (items.length === 0) return NextResponse.json({ error: 'لازم صنف واحد على الأقل بكمية' }, { status: 400 })
    const warehouseId = body.warehouseId || order.warehouseId

    for (const it of items) {
      const stock = await getStock(warehouseId, it.productId)
      if (stock < Number(it.quantity)) {
        const p = await prisma.product.findUnique({ where: { id: it.productId }, select: { name: true } })
        return NextResponse.json({ error: `الكمية المتاحة من ${p?.name || 'الصنف'} غير كافية (المتاح: ${stock})` }, { status: 400 })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.deliveryItem.deleteMany({ where: { deliveryOrderId: order.id } })
      const u = await tx.deliveryOrder.update({
        where: { id: order.id },
        data: {
          warehouseId,
          notes: body.notes !== undefined ? body.notes : order.notes,
          // أي تعديل بيلغي تجهيز المخزن السابق — لازم يتجهّز تاني على الكميات الجديدة
          preparedAt: null,
          preparedById: null,
          items: { create: items.map((it: any) => ({ productId: it.productId, quantity: Number(it.quantity) })) },
        },
        include: { items: { include: { product: true } }, delegate: true },
      })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تعديل أمر تحميل',
          description: `تعديل أمر التحميل ${order.orderNo} للمندوب ${order.delegate.name}`,
          impact: `${items.reduce((s: number, i: any) => s + Number(i.quantity), 0)} وحدة (أُعيد للتجهيز)`,
        },
      })
      return u
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'فشل تعديل أمر التحميل' }, { status: 500 })
  }
}

// حذف أمر التحميل — مسموح بس طول ما المندوب ماأكّدش الاستلام (لسه معلّق، والبضاعة ما خرجتش من المخزن)
export async function DELETE(_req: Request, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('delegates', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth

  try {
    const order = await prisma.deliveryOrder.findUnique({ where: { id: params.id }, include: { delegate: true, settlement: true } })
    if (!order) return NextResponse.json({ error: 'أمر التحميل غير موجود' }, { status: 404 })
    if (order.status !== 'PENDING' || order.settlement) {
      return NextResponse.json({ error: 'مينفعش تحذف أمر بعد ما المندوب أكّد الاستلام واتحرك' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.deliveryItem.deleteMany({ where: { deliveryOrderId: order.id } })
      await tx.deliveryOrder.delete({ where: { id: order.id } })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'حذف أمر تحميل',
          description: `حذف أمر التحميل ${order.orderNo} للمندوب ${order.delegate.name} (كان لسه معلّق)`,
          impact: 'اتشال قبل تأكيد الاستلام — مفيش أثر على المخزون',
        },
      })
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف أمر التحميل' }, { status: 500 })
  }
}
