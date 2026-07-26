import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES', 'DELEGATE'] as const

// أمر مرتجع من عميل أثناء الجولة — لازم يكون من فاتورة سابقة في نفس الجولة.
// البضاعة ترجع للعربية (يزيد المتبقي)، القيمة تُخصم من الآجل أو تُرد نقدًا،
// وبونص نقاط الفئة يترجع بنسبة قيمة المرتجع.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const reqItems: { productId: string; quantity: number }[] = (b.items || [])
      .filter((i: any) => i.productId && Number(i.quantity) > 0)
      .map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity) }))
    if (!b.invoiceId) return NextResponse.json({ error: 'لازم تختار الفاتورة اللي بترجّع منها' }, { status: 400 })
    if (reqItems.length === 0) return NextResponse.json({ error: 'حدّد كمية الإرجاع لصنف واحد على الأقل' }, { status: 400 })

    const order = await prisma.deliveryOrder.findUnique({ where: { id: params.id }, include: { delegate: true } })
    if (!order) return NextResponse.json({ error: 'الجولة غير موجودة' }, { status: 404 })
    if (session.user.role === 'DELEGATE' && order.delegate.userId !== session.user.id) {
      return NextResponse.json({ error: 'الجولة دي مش بتاعتك' }, { status: 403 })
    }
    if (order.status !== 'IN_PROGRESS') return NextResponse.json({ error: 'الجولة مش شغالة حاليًا' }, { status: 400 })

    // الفاتورة لازم تكون من نفس الجولة
    const invoice = await prisma.invoice.findUnique({
      where: { id: b.invoiceId },
      include: { items: true, customer: { include: { tier: true } } },
    })
    if (!invoice || invoice.deliveryOrderId !== order.id) {
      return NextResponse.json({ error: 'الفاتورة مش تابعة للجولة دي' }, { status: 400 })
    }

    // المباع + السعر لكل صنف في الفاتورة
    const soldByProduct = new Map<string, { sold: number; unitPrice: number }>()
    for (const it of invoice.items) {
      const prev = soldByProduct.get(it.productId) || { sold: 0, unitPrice: 0 }
      soldByProduct.set(it.productId, { sold: prev.sold + it.quantity, unitPrice: Math.max(prev.unitPrice, Number(it.unitPrice)) })
    }
    // اللي رجع قبل كده من نفس الفاتورة
    const priorReturns = await prisma.deliveryReturn.findMany({ where: { invoiceId: invoice.id }, include: { items: true } })
    const returnedByProduct = new Map<string, number>()
    for (const r of priorReturns) for (const it of r.items) returnedByProduct.set(it.productId, (returnedByProduct.get(it.productId) || 0) + it.quantity)

    // تحقّق الكميات + احسب القيمة بأسعار الفاتورة (السيرفر هو المصدر)
    const items = reqItems.map((it) => {
      const info = soldByProduct.get(it.productId)
      const available = (info?.sold || 0) - (returnedByProduct.get(it.productId) || 0)
      return { productId: it.productId, quantity: it.quantity, unitPrice: info?.unitPrice || 0, available }
    })
    for (const it of items) {
      if (!soldByProduct.has(it.productId)) return NextResponse.json({ error: 'صنف مش موجود في الفاتورة دي' }, { status: 400 })
      if (it.quantity > it.available) return NextResponse.json({ error: `كمية الإرجاع أكبر من المتاح (${it.available})` }, { status: 400 })
    }

    const totalValue = +items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)
    const refundCash = !!b.refundCash
    // بونص نقاط الفئة يترجع بنسبة قيمة المرتجع
    const bonusPct = invoice.customer.tier ? Number(invoice.customer.tier.bonusPercent) : 0
    const pointsReversed = bonusPct > 0 ? +((totalValue * bonusPct) / 100).toFixed(2) : 0
    const count = await prisma.deliveryReturn.count()

    const ret = await prisma.$transaction(async (tx) => {
      const created = await tx.deliveryReturn.create({
        data: {
          returnNo: `RET-${String(count + 1).padStart(4, '0')}`,
          deliveryOrderId: order.id,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          customerName: invoice.customer.name,
          refundCash,
          pointsReversed,
          totalValue,
          reason: b.reason?.trim() || null,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.quantity * i.unitPrice })) },
        },
        include: { items: true },
      })

      // تعديل رصيد العميل + إرجاع البونص
      const data: any = {}
      if (totalValue > 0) data.totalPurchases = { decrement: totalValue }
      if (!refundCash && totalValue > 0) data.balance = { decrement: totalValue } // خصم من الآجل
      if (pointsReversed > 0) data.bonusPoints = { decrement: pointsReversed }
      if (Object.keys(data).length > 0) {
        await tx.customer.update({ where: { id: invoice.customerId }, data })
        // منع الرصيد السالب للبونص
        const c = await tx.customer.findUnique({ where: { id: invoice.customerId }, select: { bonusPoints: true } })
        if (c && Number(c.bonusPoints) < 0) await tx.customer.update({ where: { id: invoice.customerId }, data: { bonusPoints: 0 } })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'مرتجع جولة',
          description: `مرتجع ${created.returnNo} من فاتورة ${invoice.invoiceNo} - ${invoice.customer.name}`,
          impact: `${refundCash ? 'رد نقدي' : 'خصم آجل'} ${totalValue.toFixed(2)} ج.م${pointsReversed > 0 ? ` · إرجاع ${pointsReversed} نقطة` : ''} · رجع للعربية`,
        },
      })
      return created
    })

    return NextResponse.json(ret, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تسجيل المرتجع' }, { status: 500 })
  }
}
