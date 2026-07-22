import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getDefaultWarehouseId, getStock } from '@/lib/warehouse'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function GET(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const status = req.nextUrl.searchParams.get('status')
    const deliveryOrders = await prisma.deliveryOrder.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        delegate: true,
        items: { include: { product: true } },
        creator: true,
        settlement: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(deliveryOrders)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch delivery orders' }, { status: 500 })
  }
}

// أمر تحميل جديد (مدير المبيعات): بيتعمل «معلّق» ويحدد المخزن — البضاعة لسه في المخزن.
// المندوب لازم يأكّد استلام الحمولة (مطابقة) وساعتها البضاعة تخرج من المخزن وتتحرك العربية.
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { delegateId, items, notes } = body
    const warehouseId = body.warehouseId || (await getDefaultWarehouseId())

    if (!delegateId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'اختار المندوب وصنف واحد على الأقل' }, { status: 400 })
    }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
    })

    // تأكيد إن الكميات متاحة في المخزن المختار وقت عمل الأمر
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)
      const stock = await getStock(warehouseId, item.productId)
      if (!product || stock < item.quantity) {
        return NextResponse.json(
          { error: `الكمية المتاحة من ${product?.name || item.productId} في المخزن ده غير كافية (المتاح: ${stock})` },
          { status: 400 }
        )
      }
    }

    const deliveryOrder = await prisma.deliveryOrder.create({
      data: {
        orderNo: `DEL-${Date.now()}`,
        delegateId,
        warehouseId,
        status: 'PENDING', // مستني تأكيد استلام المندوب
        notes,
        createdById: session.user.id,
        items: {
          create: items.map((item: any) => ({ productId: item.productId, quantity: item.quantity })),
        },
      },
      include: { items: { include: { product: true } }, delegate: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'أمر تحميل',
        description: `أمر تحميل للمندوب ${deliveryOrder.delegate.name} - ${deliveryOrder.orderNo} (مستني تأكيد الاستلام)`,
        impact: `${items.reduce((s: number, i: any) => s + i.quantity, 0)} وحدة مخصّصة`,
      },
    })

    return NextResponse.json(deliveryOrder, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create delivery order' }, { status: 500 })
  }
}
