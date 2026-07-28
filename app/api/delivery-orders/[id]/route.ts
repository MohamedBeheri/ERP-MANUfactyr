import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


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
        .reduce((sum, invItem) => sum + invItem.quantity, 0)

      return {
        productId: item.productId,
        productName: item.product.name,
        loaded: item.quantity,
        delivered,
        remaining: item.quantity - delivered,
      }
    })

    return NextResponse.json({ ...deliveryOrder, remaining })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch delivery order' }, { status: 500 })
  }
}
