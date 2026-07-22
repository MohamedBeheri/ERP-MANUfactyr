import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { computeBonuses } from '@/lib/rewards'
import { customerUnitPrice } from '@/lib/tiers'

const ALLOWED_ROLES = ['ADMIN', 'SALES', 'DELEGATE'] as const

// تسليم لعميل أثناء جولة التوزيع. البضاعة خرجت من المخزن أصلاً وقت التحميل،
// فهنا بس بننشئ فاتورة مرتبطة بالجولة من غير ما نلمس Product.quantity تاني.
// السعر بيتحسب على السيرفر حسب فئة/نوع العميل — المندوب ما بيحطش سعر بإيده.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { customerId, items } = body
    // طريقة الدفع: نقدي فوري | آجل | نقدي جزئي
    const paymentMethod = body.paymentMethod || (body.type === 'CREDIT' ? 'آجل' : 'نقدي فوري')
    const notes = body.notes?.trim() || null

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'اختار عميل وصنف واحد على الأقل' }, { status: 400 })
    }

    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: {
        delegate: true,
        items: true,
        invoices: { include: { items: true } },
        returns: { include: { items: true } },
      },
    })

    if (!deliveryOrder) {
      return NextResponse.json({ error: 'أمر التحميل غير موجود' }, { status: 404 })
    }
    // المندوب يقدر يسلّم من جولته هو بس
    if (session.user.role === 'DELEGATE' && deliveryOrder.delegate.userId !== session.user.id) {
      return NextResponse.json({ error: 'الجولة دي مش بتاعتك' }, { status: 403 })
    }
    if (deliveryOrder.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'الجولة دي مش شغالة حاليًا (خلصت أو اتلغت)' }, { status: 400 })
    }

    // المتبقي على العربية = المحمّل − المسلّم + المرتجع للعربية
    const remainingOf = (productId: string) => {
      const loaded = deliveryOrder.items.find((i) => i.productId === productId)?.quantity || 0
      const delivered = deliveryOrder.invoices
        .flatMap((inv) => inv.items)
        .filter((it) => it.productId === productId)
        .reduce((s, it) => s + it.quantity, 0)
      const returnedToVan = deliveryOrder.returns
        .flatMap((r) => r.items)
        .filter((it) => it.productId === productId)
        .reduce((s, it) => s + it.quantity, 0)
      return loaded - delivered + returnedToVan
    }

    for (const item of items) {
      if (item.quantity > remainingOf(item.productId)) {
        return NextResponse.json(
          { error: `الكمية المطلوبة أكبر من المتبقي على العربية (متبقي: ${remainingOf(item.productId)})` },
          { status: 400 }
        )
      }
    }

    // ===== تسعير السيرفر: حسب فئة/نوع العميل (المندوب ما بيحطش سعر) =====
    const buyer = await prisma.customer.findUnique({ where: { id: customerId }, include: { tier: true } })
    if (!buyer) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })

    const productIds = items.map((it: any) => it.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sellPrice: true, wholesalePrice: true },
    })
    const buyerPricing = {
      customerType: buyer.customerType,
      tier: buyer.tier ? { priceSource: buyer.tier.priceSource, discountPercent: Number(buyer.tier.discountPercent) } : null,
    }
    const priceMap = new Map(products.map((p) => [p.id, customerUnitPrice(Number(p.sellPrice), Number(p.wholesalePrice), buyerPricing)]))

    const pricedItems = items.map((it: any) => ({
      productId: it.productId,
      quantity: Number(it.quantity),
      unitPrice: priceMap.get(it.productId) ?? 0,
    }))

    const totalAmount = pricedItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
    const netAmount = +totalAmount.toFixed(2) // الخصم داخل السعر أصلاً (حسب الفئة)

    // المدفوع فعليًا حسب طريقة الدفع
    let type: 'CASH' | 'CREDIT' = 'CASH'
    let paidAmount = netAmount
    if (paymentMethod === 'آجل') {
      type = 'CREDIT'; paidAmount = 0
    } else if (paymentMethod === 'نقدي جزئي') {
      type = 'CREDIT'; paidAmount = Math.max(0, Math.min(netAmount, Number(body.paidAmount) || 0))
    }
    const remaining = netAmount - paidAmount // اللي هيتحمّل على رصيد العميل

    // ===== مكافآت الكمية (هدايا) =====
    const rawBonuses = await computeBonuses(prisma, buyer.tierId ?? null, pricedItems)
    const bonusLines = rawBonuses
      .map((b) => {
        const paidThisInvoice = pricedItems.filter((it) => it.productId === b.productId).reduce((s, it) => s + it.quantity, 0)
        const available = remainingOf(b.productId) - paidThisInvoice
        return { ...b, quantity: Math.max(0, Math.min(b.quantity, available)) }
      })
      .filter((b) => b.quantity > 0)

    // ===== بونص نقاط الفئة (نسبة من صافي الفاتورة) =====
    const bonusEarned = buyer.tier ? +((netAmount * Number(buyer.tier.bonusPercent)) / 100).toFixed(2) : 0

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: `INV-${Date.now()}`,
        customerId,
        totalAmount,
        discount: 0,
        netAmount,
        paidAmount,
        type,
        paymentMethod,
        invoiceNotes: notes,
        delegateId: deliveryOrder.delegateId,
        deliveryOrderId: deliveryOrder.id,
        createdById: session.user.id,
        items: {
          create: [
            ...pricedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            })),
            ...bonusLines.map((b) => ({
              productId: b.productId,
              quantity: b.quantity,
              unitPrice: 0,
              totalPrice: 0,
              isBonus: true,
              rewardRuleId: b.rewardRuleId,
            })),
          ],
        },
      },
      include: { items: true, customer: true },
    })

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalPurchases: { increment: netAmount },
        ...(remaining > 0 ? { balance: { increment: remaining } } : {}),
        ...(bonusEarned > 0 ? { bonusPoints: { increment: bonusEarned } } : {}),
      },
    })

    const bonusTotal = bonusLines.reduce((s, b) => s + b.quantity, 0)
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'تسليم مندوب',
        description: `تسليم للعميل ${invoice.customer.name} - فاتورة ${invoice.invoiceNo} - أمر ${deliveryOrder.orderNo}`,
        impact: `+${netAmount} ج.م${bonusTotal > 0 ? ` + ${bonusTotal} هدية` : ''}${bonusEarned > 0 ? ` + ${bonusEarned} نقطة` : ''}`,
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'فشل تسجيل التسليم' }, { status: 500 })
  }
}
