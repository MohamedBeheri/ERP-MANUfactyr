import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

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
        settlement: true,
        delegate: true,
      },
    })

    if (!deliveryOrder) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 })
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

    for (const ret of returns) {
      const loaded = deliveryOrder.items.find((i) => i.productId === ret.productId)?.quantity || 0
      const delivered = deliveredByProduct.get(ret.productId) || 0
      const maxReturnable = loaded - delivered
      if (ret.quantity > maxReturnable) {
        return NextResponse.json(
          { error: `الكمية المرتجعة أكبر من المتبقي على العربية (أقصى حد: ${maxReturnable})` },
          { status: 400 }
        )
      }
    }

    const soldQty = Array.from(deliveredByProduct.values()).reduce((s, q) => s + q, 0)
    const returnedQty = returns.reduce((s, r) => s + r.quantity, 0)
    const cashAmount = deliveryOrder.invoices
      .filter((inv) => inv.type === 'CASH')
      .reduce((s, inv) => s + Number(inv.netAmount), 0)
    const creditAmount = deliveryOrder.invoices
      .filter((inv) => inv.type === 'CREDIT')
      .reduce((s, inv) => s + Number(inv.netAmount), 0)
    const totalSalesValue = cashAmount + creditAmount
    const commission = (totalSalesValue * Number(deliveryOrder.delegate.commissionRate)) / 100

    for (const ret of returns) {
      if (ret.quantity <= 0) continue
      await prisma.product.update({
        where: { id: ret.productId },
        data: { quantity: { increment: ret.quantity } },
      })
      await prisma.warehouseIn.create({
        data: {
          productId: ret.productId,
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
        impact: `مبيعات ${totalSalesValue} ج.م - عمولة ${commission} ج.م - مرتجع ${returnedQty}`,
      },
    })

    return NextResponse.json(settlement, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to settle delivery order' }, { status: 500 })
  }
}
