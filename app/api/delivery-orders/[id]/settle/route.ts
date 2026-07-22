import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getDefaultWarehouseId, adjustStock } from '@/lib/warehouse'

const ALLOWED_ROLES = ['ADMIN', 'SALES', 'DELEGATE'] as const

// تسوية آخر اليوم: المباع والمحصّل بيتحسبوا تلقائي من الفواتير المرتبطة بالجولة،
// والمستخدم بس بيدخل الكمية المرتجعة الفعلية (جرد) لكل صنف عشان ترجع للمخزن.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const returns: { productId: string; quantity: number }[] = body.returns || []
    const notes = body.notes as string | undefined

    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        invoices: { include: { items: true } },
        keyAccountSupplies: { include: { items: true } },
        returns: { include: { items: true } },
        settlement: true,
        delegate: true,
      },
    })

    if (!deliveryOrder) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 })
    }
    if (session.user.role === 'DELEGATE' && deliveryOrder.delegate.userId !== session.user.id) {
      return NextResponse.json({ error: 'الجولة دي مش بتاعتك' }, { status: 403 })
    }
    if (deliveryOrder.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'الجولة دي مش شغالة حاليًا (خلصت أو اتلغت)' }, { status: 400 })
    }
    if (deliveryOrder.settlement) {
      return NextResponse.json({ error: 'الجولة دي اتعمللها تسوية قبل كده' }, { status: 400 })
    }

    const deliveredByProduct = new Map<string, number>()
    for (const inv of deliveryOrder.invoices) {
      for (const item of inv.items) {
        deliveredByProduct.set(item.productId, (deliveredByProduct.get(item.productId) || 0) + item.quantity)
      }
    }
    // التوريدات لفروع كبار الموردين بتنزل من العربية زي التسليمات
    for (const sup of deliveryOrder.keyAccountSupplies) {
      for (const item of sup.items) {
        deliveredByProduct.set(item.productId, (deliveredByProduct.get(item.productId) || 0) + item.quantity)
      }
    }

    // المرتجعات اللي رجعت للعربية أثناء الجولة بتزوّد المتبقي القابل للإرجاع للمخزن
    const returnedToVan = new Map<string, number>()
    for (const r of deliveryOrder.returns) {
      for (const item of r.items) {
        returnedToVan.set(item.productId, (returnedToVan.get(item.productId) || 0) + item.quantity)
      }
    }

    for (const ret of returns) {
      const loaded = deliveryOrder.items.find((i) => i.productId === ret.productId)?.quantity || 0
      const delivered = deliveredByProduct.get(ret.productId) || 0
      const maxReturnable = loaded - delivered + (returnedToVan.get(ret.productId) || 0)
      if (ret.quantity > maxReturnable) {
        return NextResponse.json(
          { error: `الكمية المرتجعة أكبر من المتبقي على العربية (أقصى حد: ${maxReturnable})` },
          { status: 400 }
        )
      }
    }

    // إجمالي الهدايا اللي اتوزّعت في الجولة (بنود البونص)، والمباع المدفوع = الكل − الهدايا
    const bonusQty = deliveryOrder.invoices
      .flatMap((inv) => inv.items)
      .filter((it) => it.isBonus)
      .reduce((s, it) => s + it.quantity, 0)
    const totalDelivered = Array.from(deliveredByProduct.values()).reduce((s, q) => s + q, 0)
    const soldQty = Math.max(0, totalDelivered - bonusQty)
    const returnedQty = returns.reduce((s, r) => s + r.quantity, 0)
    // النقدي = المدفوع فعليًا (يشمل الجزء المدفوع في البيع الجزئي)، الآجل = المتبقي على العملاء
    const cashAmount = deliveryOrder.invoices.reduce((s, inv) => s + Number(inv.paidAmount), 0)
    const invoiceCredit = deliveryOrder.invoices.reduce(
      (s, inv) => s + (Number(inv.netAmount) - Number(inv.paidAmount)),
      0
    )
    // توريدات كبار الموردين مطالبات (آجل) على المقر الرئيسي
    const keyAccountCredit = deliveryOrder.keyAccountSupplies.reduce((s, sup) => s + Number(sup.netAmount), 0)
    const creditAmount = invoiceCredit + keyAccountCredit
    const totalSalesValue = cashAmount + creditAmount
    const commission = (totalSalesValue * Number(deliveryOrder.delegate.commissionRate)) / 100

    const warehouseId = body.warehouseId || (await getDefaultWarehouseId())

    for (const ret of returns) {
      if (ret.quantity <= 0) continue
      await prisma.product.update({
        where: { id: ret.productId },
        data: { quantity: { increment: ret.quantity } },
      })
      await adjustStock(prisma, warehouseId, ret.productId, ret.quantity)
      await prisma.warehouseIn.create({
        data: {
          productId: ret.productId,
          warehouseId,
          quantity: ret.quantity,
          source: `عودة من تسليم - أمر ${deliveryOrder.orderNo}`,
          createdById: session.user.id,
        },
      })
    }

    const settlement = await prisma.settlement.create({
      data: {
        delegateId: deliveryOrder.delegateId,
        deliveryOrderId: deliveryOrder.id,
        soldQty,
        bonusQty,
        returnedQty,
        cashAmount,
        creditAmount,
        commission,
        notes,
        createdById: session.user.id,
      },
    })

    await prisma.delegate.update({
      where: { id: deliveryOrder.delegateId },
      data: {
        totalSales: { increment: totalSalesValue },
        commissionDue: { increment: commission },
      },
    })

    await prisma.deliveryOrder.update({
      where: { id: deliveryOrder.id },
      data: { status: 'COMPLETED' },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'تسوية',
        description: `تسوية جولة ${deliveryOrder.orderNo} للمندوب ${deliveryOrder.delegate.name}`,
        impact: `مبيعات ${totalSalesValue} ج.م - عمولة ${commission} ج.م - مرتجع ${returnedQty}${bonusQty > 0 ? ` - هدايا ${bonusQty}` : ''}`,
      },
    })

    return NextResponse.json(settlement, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to settle delivery order' }, { status: 500 })
  }
}
