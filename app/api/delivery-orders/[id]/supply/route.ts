import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

// توريد لفرع من فروع كبار الموردين أثناء جولة المندوب.
// البضاعة خرجت من المخزن وقت التحميل، فهنا بننشئ توريد ونضيف مطالبة على المقر الرئيسي فقط.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const { keyAccountId, branchId, discountType, discountPercent, notes } = b
    const items: { productId: string; quantity: number; unitPrice: number }[] = (b.items || [])
      .filter((i: any) => i.productId && Number(i.quantity) > 0 && Number(i.unitPrice) >= 0)
      .map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))

    if (!keyAccountId || !branchId || items.length === 0) {
      return NextResponse.json({ error: 'اختار العميل والفرع وصنف واحد على الأقل' }, { status: 400 })
    }

    const order = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        invoices: { include: { items: true } },
        keyAccountSupplies: { include: { items: true } },
      },
    })
    if (!order) return NextResponse.json({ error: 'الجولة غير موجودة' }, { status: 404 })
    if (order.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'الجولة دي مش شغالة حاليًا' }, { status: 400 })
    }

    const branch = await prisma.keyAccountBranch.findUnique({ where: { id: branchId } })
    if (!branch || branch.keyAccountId !== keyAccountId) {
      return NextResponse.json({ error: 'الفرع مش تابع للعميل المختار' }, { status: 400 })
    }

    // المتبقي على العربية = المحمّل − (مسلّم في فواتير + موّرد لفروع)
    for (const it of items) {
      const loaded = order.items.find((x) => x.productId === it.productId)?.quantity || 0
      const invDelivered = order.invoices.flatMap((iv) => iv.items).filter((x) => x.productId === it.productId).reduce((s, x) => s + x.quantity, 0)
      const supDelivered = order.keyAccountSupplies.flatMap((sp) => sp.items).filter((x) => x.productId === it.productId).reduce((s, x) => s + x.quantity, 0)
      const remaining = loaded - invDelivered - supDelivered
      if (it.quantity > remaining) {
        const p = await prisma.product.findUnique({ where: { id: it.productId } })
        return NextResponse.json({ error: `الكمية أكبر من المتبقي على العربية لـ ${p?.name || 'الصنف'} (متبقي: ${remaining})` }, { status: 400 })
      }
      // الحد الأدنى لكبار الموردين
      const p = await prisma.product.findUnique({ where: { id: it.productId } })
      const floor = Number(p?.minKeyPrice) || 0
      if (floor > 0 && it.unitPrice < floor) {
        return NextResponse.json({ error: `سعر ${p?.name} أقل من الحد الأدنى لكبار الموردين (${floor} ج.م)` }, { status: 400 })
      }
    }

    const totalAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const dPercent = discountType === 'CASH' ? Number(discountPercent) || 0 : 0
    const netAmount = totalAmount - (totalAmount * dPercent) / 100

    const count = await prisma.keyAccountSupply.count()

    const supply = await prisma.$transaction(async (tx) => {
      const created = await tx.keyAccountSupply.create({
        data: {
          supplyNo: `SUP-${String(count + 1).padStart(4, '0')}`,
          keyAccountId,
          branchId,
          deliveryOrderId: order.id,
          delegateId: order.delegateId,
          totalAmount,
          discountType: discountType === 'CASH' ? 'CASH' : 'NONE',
          discountPercent: dPercent,
          netAmount,
          notes: notes?.trim() || null,
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
        include: { items: true, branch: true, keyAccount: true },
      })

      // المطالبة تتجمّع على المقر الرئيسي
      await tx.keyAccount.update({
        where: { id: keyAccountId },
        data: { balance: { increment: netAmount }, totalPurchases: { increment: netAmount } },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'توريد فرع',
          description: `توريد ${created.supplyNo} لفرع ${created.branch.name} - ${created.keyAccount.name} (جولة ${order.orderNo})`,
          impact: `مطالبة +${netAmount.toFixed(2)} ج.م على المقر`,
        },
      })

      return created
    })

    return NextResponse.json(supply, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تسجيل التوريد' }, { status: 500 })
  }
}
