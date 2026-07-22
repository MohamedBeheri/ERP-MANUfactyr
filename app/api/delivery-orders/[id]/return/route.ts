import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES', 'DELEGATE'] as const

// أمر مرتجع من عميل أثناء الجولة — البضاعة ترجع للعربية (يزيد المتبقي)،
// والقيمة تُخصم من رصيد العميل الآجل أو تُرد نقدًا.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const items: { productId: string; quantity: number; unitPrice: number }[] = (b.items || [])
      .filter((i: any) => i.productId && Number(i.quantity) > 0)
      .map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) || 0 }))
    if (items.length === 0) return NextResponse.json({ error: 'أضف صنف مرتجع واحد على الأقل' }, { status: 400 })

    const order = await prisma.deliveryOrder.findUnique({ where: { id: params.id }, include: { delegate: true } })
    if (!order) return NextResponse.json({ error: 'الجولة غير موجودة' }, { status: 404 })
    if (session.user.role === 'DELEGATE' && order.delegate.userId !== session.user.id) {
      return NextResponse.json({ error: 'الجولة دي مش بتاعتك' }, { status: 403 })
    }
    if (order.status !== 'IN_PROGRESS') return NextResponse.json({ error: 'الجولة مش شغالة حاليًا' }, { status: 400 })

    const totalValue = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const refundCash = !!b.refundCash
    const count = await prisma.deliveryReturn.count()

    const ret = await prisma.$transaction(async (tx) => {
      const created = await tx.deliveryReturn.create({
        data: {
          returnNo: `RET-${String(count + 1).padStart(4, '0')}`,
          deliveryOrderId: order.id,
          customerId: b.customerId || null,
          customerName: b.customerName?.trim() || null,
          refundCash,
          totalValue,
          reason: b.reason?.trim() || null,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.quantity * i.unitPrice,
            })),
          },
        },
        include: { items: true },
      })

      // لو مرتجع من عميل مسجّل وبيخصم من الآجل: نقلّل رصيده ومشترياته
      if (b.customerId && !refundCash && totalValue > 0) {
        await tx.customer.update({
          where: { id: b.customerId },
          data: {
            balance: { decrement: totalValue },
            totalPurchases: { decrement: totalValue },
          },
        })
      } else if (b.customerId && refundCash && totalValue > 0) {
        await tx.customer.update({
          where: { id: b.customerId },
          data: { totalPurchases: { decrement: totalValue } },
        })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'مرتجع جولة',
          description: `مرتجع ${created.returnNo} - أمر ${order.orderNo}${b.customerName ? ` من ${b.customerName}` : ''}`,
          impact: `${refundCash ? 'رد نقدي' : 'خصم آجل'} ${totalValue.toFixed(2)} ج.م - رجع للعربية`,
        },
      })

      return created
    })

    return NextResponse.json(ret, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تسجيل المرتجع' }, { status: 500 })
  }
}
