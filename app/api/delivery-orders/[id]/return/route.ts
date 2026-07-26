import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES', 'DELEGATE'] as const

// مرتجع من عميل — لازم يكون من فاتورة سابقة (أي فاتورة للعميل، حتى من جولة/شهر سابق).
// البضاعة ترجع لعربية الجولة الحالية. لو المرتجع كسّر شرط العرض، لازم يترجّع الهدية كمان.
// وبونص نقاط الفئة يترجع بنسبة قيمة المرتجع.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    // البنود بترجع بمعرّف بند الفاتورة (عشان نفرّق المدفوع عن الهدية لنفس الصنف)
    const reqItems: { invoiceItemId: string; quantity: number }[] = (b.items || [])
      .filter((i: any) => i.invoiceItemId && Number(i.quantity) > 0)
      .map((i: any) => ({ invoiceItemId: i.invoiceItemId, quantity: Number(i.quantity) }))
    if (!b.invoiceId) return NextResponse.json({ error: 'لازم تختار الفاتورة اللي بترجّع منها' }, { status: 400 })
    if (reqItems.length === 0) return NextResponse.json({ error: 'حدّد كمية الإرجاع لصنف واحد على الأقل' }, { status: 400 })

    const order = await prisma.deliveryOrder.findUnique({ where: { id: params.id }, include: { delegate: true } })
    if (!order) return NextResponse.json({ error: 'الجولة غير موجودة' }, { status: 404 })
    if (session.user.role === 'DELEGATE' && order.delegate.userId !== session.user.id) {
      return NextResponse.json({ error: 'الجولة دي مش بتاعتك' }, { status: 403 })
    }
    if (order.status !== 'IN_PROGRESS') return NextResponse.json({ error: 'الجولة مش شغالة حاليًا' }, { status: 400 })

    // أي فاتورة للعميل (مش لازم من نفس الجولة)
    const invoice = await prisma.invoice.findUnique({
      where: { id: b.invoiceId },
      include: { items: { include: { product: true, rewardRule: true, returnItems: true } }, customer: { include: { tier: true } } },
    })
    if (!invoice) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 400 })

    const lineById = new Map(invoice.items.map((it) => [it.id, it]))
    const priorReturned = new Map(invoice.items.map((it) => [it.id, it.returnItems.reduce((s, r) => s + r.quantity, 0)]))
    const thisReturn = new Map(reqItems.map((i) => [i.invoiceItemId, i.quantity]))

    // تحقّق الكميات لكل بند
    for (const ri of reqItems) {
      const line = lineById.get(ri.invoiceItemId)
      if (!line) return NextResponse.json({ error: 'بند مش موجود في الفاتورة دي' }, { status: 400 })
      const avail = line.quantity - (priorReturned.get(line.id) || 0)
      if (ri.quantity > avail) return NextResponse.json({ error: `كمية الإرجاع أكبر من المتاح (${avail}) لـ ${line.product.name}` }, { status: 400 })
    }

    // ===== فحص شرط العرض: لو رجّع كمية خلّت الشرط مش محقق لازم يرجّع الهدية =====
    const keptOf = (l: (typeof invoice.items)[number]) => l.quantity - (priorReturned.get(l.id) || 0) - (thisReturn.get(l.id) || 0)
    const ruleIds = Array.from(new Set(invoice.items.filter((it) => it.isBonus && it.rewardRuleId).map((it) => it.rewardRuleId as string)))
    for (const ruleId of ruleIds) {
      const giftLines = invoice.items.filter((it) => it.isBonus && it.rewardRuleId === ruleId)
      const rule = giftLines[0].rewardRule
      if (!rule) continue
      const paidLines = invoice.items.filter((it) => !it.isBonus && it.productId === rule.productId)
      const keptPaid = paidLines.reduce((s, l) => s + keptOf(l), 0)
      const entitle = rule.repeat ? Math.floor(keptPaid / rule.buyQuantity) * rule.freeQuantity : keptPaid >= rule.buyQuantity ? rule.freeQuantity : 0
      const giftKept = giftLines.reduce((s, l) => s + keptOf(l), 0)
      if (giftKept > entitle) {
        return NextResponse.json(
          { error: `العرض مبقاش محقق بعد الإرجاع — لازم ترجّع كمان ${giftKept - entitle} من الهدية (${giftLines[0].product.name}) اللي العميل أخدها.` },
          { status: 400 }
        )
      }
    }

    // القيمة (السيرفر هو المصدر) — الهدايا بصفر
    const items = reqItems.map((ri) => {
      const line = lineById.get(ri.invoiceItemId)!
      return { invoiceItemId: line.id, productId: line.productId, isBonus: line.isBonus, quantity: ri.quantity, unitPrice: Number(line.unitPrice) }
    })
    const totalValue = +items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)
    const refundCash = !!b.refundCash
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
          items: { create: items.map((i) => ({ productId: i.productId, invoiceItemId: i.invoiceItemId, isBonus: i.isBonus, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.quantity * i.unitPrice })) },
        },
        include: { items: true },
      })

      const data: any = {}
      if (totalValue > 0) data.totalPurchases = { decrement: totalValue }
      if (!refundCash && totalValue > 0) data.balance = { decrement: totalValue }
      if (pointsReversed > 0) data.bonusPoints = { decrement: pointsReversed }
      if (Object.keys(data).length > 0) {
        await tx.customer.update({ where: { id: invoice.customerId }, data })
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
