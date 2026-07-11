import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

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

// تحميل عربية جديدة: بضاعة بتخرج من المخزن مرة واحدة هنا، والتسليمات للعملاء
// بعد كده بتتخصم من رصيد العربية (loaded - delivered) مش من المخزن تاني.
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { delegateId, items, notes } = body

    if (!delegateId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'delegateId and items are required' }, { status: 400 })
    }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
    })

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)
      if (!product || product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `الكمية المتاحة من ${product?.name || item.productId} غير كافية` },
          { status: 400 }
        )
      }
    }

    const deliveryOrder = await prisma.deliveryOrder.create({
      data: {
        orderNo: `DEL-${Date.now()}`,
        delegateId,
        status: 'IN_PROGRESS',
        notes,
        createdById: session.user.id,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: { include: { product: true } }, delegate: true },
    })

    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { quantity: { decrement: item.quantity } },
      })
      await prisma.warehouseOut.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          target: `مندوب: ${deliveryOrder.delegate.name}`,
          reason: `تحميل عربية - أمر تسليم ${deliveryOrder.orderNo}`,
          createdById: session.user.id,
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'تحميل',
        description: `تحميل عربية للمندوب ${deliveryOrder.delegate.name} - أمر ${deliveryOrder.orderNo}`,
        impact: `-${items.reduce((s: number, i: any) => s + i.quantity, 0)} من المخزن`,
      },
    })

    return NextResponse.json(deliveryOrder, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create delivery order' }, { status: 500 })
  }
}
