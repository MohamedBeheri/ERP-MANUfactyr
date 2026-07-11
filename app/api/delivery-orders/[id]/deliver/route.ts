import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

// تسليم لعميل أثناء جولة التوزيع. البضاعة خرجت من المخزن أصلاً وقت التحميل،
// فهنا بس بننشئ فاتورة مرتبطة بالجولة من غير ما نلمس Product.quantity تاني.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { customerId, items, type, discount } = body

    if (!customerId || !Array.isArray(items) || items.length === 0 || !type) {
      return NextResponse.json({ error: 'customerId, items and type are required' }, { status: 400 })
    }

    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        invoices: { include: { items: true } },
      },
    })

    if (!deliveryOrder) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 })
    }
    if (deliveryOrder.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'الجولة دي مش شغالة حاليًا (خلصت أو اتلغت)' }, { status: 400 })
    }

    for (const item of items) {
      const loaded = deliveryOrder.items.find((i) => i.productId === item.productId)?.quantity || 0
      const alreadyDelivered = deliveryOrder.invoices
        .flatMap((inv) => inv.items)
        .filter((invItem) => invItem.productId === item.productId)
        .reduce((sum, invItem) => sum + invItem.quantity, 0)
      const remaining = loaded - alreadyDelivered

      if (item.quantity > remaining) {
        return NextResponse.json(
          { error: `الكمية المطلوبة أكبر من المتبقي على العربية (متبقي: ${remaining})` },
          { status: 400 }
        )
      }
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0)
    const netAmount = totalAmount - (totalAmount * (discount || 0)) / 100

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: `INV-${Date.now()}`,
        customerId,
        totalAmount,
        discount: discount || 0,
        netAmount,
        type,
        delegateId: deliveryOrder.delegateId,
        deliveryOrderId: deliveryOrder.id,
        createdById: session.user.id,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: true, customer: true },
    })

    if (type === 'CREDIT') {
      await prisma.customer.update({
        where: { id: customerId },
        data: { balance: { increment: netAmount }, totalPurchases: { increment: netAmount } },
      })
    } else {
      await prisma.customer.update({
        where: { id: customerId },
        data: { totalPurchases: { increment: netAmount } },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'تسليم مندوب',
        description: `تسليم للعميل ${invoice.customer.name} - فاتورة ${invoice.invoiceNo} - أمر ${deliveryOrder.orderNo}`,
        impact: `+${netAmount} ج.م`,
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to record delivery' }, { status: 500 })
  }
}
