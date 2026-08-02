import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { applyTreasuryTxn, CLEARING_NAME } from '@/lib/treasuries'

// تسوية دفعة تحويلات إنستا باي: نقل إجماليها من الحساب الوسيط للحساب البنكي
export async function POST(req: NextRequest) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const ids: string[] = Array.isArray(b.collectionIds) ? b.collectionIds : []
    if (ids.length === 0 || !b.targetBankTreasuryId) {
      return NextResponse.json({ error: 'اختار التحويلات والحساب البنكي المستهدف' }, { status: 400 })
    }

    const [bank, clearing] = await Promise.all([
      prisma.treasury.findUnique({ where: { id: b.targetBankTreasuryId } }),
      prisma.treasury.findUnique({ where: { name: CLEARING_NAME } }),
    ])
    if (!bank || bank.type !== 'BANK') return NextResponse.json({ error: 'الحساب المستهدف لازم يكون حساب بنكي' }, { status: 400 })
    if (!clearing) return NextResponse.json({ error: 'الحساب الوسيط غير موجود' }, { status: 400 })

    const collections = await prisma.collection.findMany({
      where: { id: { in: ids }, isSettled: false, treasuryId: clearing.id },
    })
    if (collections.length === 0) {
      return NextResponse.json({ error: 'مفيش تحويلات صالحة للتسوية في الاختيار ده' }, { status: 400 })
    }

    const total = collections.reduce((s, c) => s + Number(c.amount), 0)
    const refs = collections.map((c) => c.transactionReference || c.collectionNo).join('، ')

    await prisma.$transaction(async (tx) => {
      await applyTreasuryTxn(tx, {
        treasuryId: clearing.id,
        type: 'OUT',
        amount: total,
        refType: 'instapay-settle',
        reference: refs.slice(0, 190),
        description: `تسوية ${collections.length} تحويل إنستا باي إلى ${bank.name}`,
        createdById: session.user.id,
      })
      await applyTreasuryTxn(tx, {
        treasuryId: bank.id,
        type: 'IN',
        amount: total,
        refType: 'instapay-settle',
        reference: refs.slice(0, 190),
        description: `مطابقة ${collections.length} تحويل إنستا باي من ${CLEARING_NAME}`,
        createdById: session.user.id,
      })
      await tx.collection.updateMany({
        where: { id: { in: collections.map((c) => c.id) } },
        data: { isSettled: true, settledAt: new Date() },
      })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تسوية إنستا باي',
          description: `مطابقة ${collections.length} تحويل مع ${bank.name}`,
          impact: `${total.toFixed(2)} ج.م`,
        },
      })
    })

    return NextResponse.json({ success: true, settled: collections.length, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تسوية التحويلات' }, { status: 500 })
  }
}
