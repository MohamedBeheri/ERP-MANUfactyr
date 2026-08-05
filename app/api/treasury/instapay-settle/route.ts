import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { applyTreasuryTxn, CLEARING_NAME, WALLET_CLEARING_NAME } from '@/lib/treasuries'

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

    const [bank, clearing, walletClearing] = await Promise.all([
      prisma.treasury.findUnique({ where: { id: b.targetBankTreasuryId } }),
      prisma.treasury.findUnique({ where: { name: CLEARING_NAME } }),
      prisma.treasury.findUnique({ where: { name: WALLET_CLEARING_NAME } }),
    ])
    if (!bank || bank.type !== 'BANK') return NextResponse.json({ error: 'الحساب المستهدف لازم يكون حساب بنكي' }, { status: 400 })
    if (!clearing) return NextResponse.json({ error: 'الحساب الوسيط غير موجود' }, { status: 400 })

    const clearingIds = [clearing.id, ...(walletClearing ? [walletClearing.id] : [])]
    const collections = await prisma.collection.findMany({
      where: { id: { in: ids }, isSettled: false, treasuryId: { in: clearingIds } },
    })
    if (collections.length === 0) {
      return NextResponse.json({ error: 'مفيش تحويلات صالحة للتسوية في الاختيار ده' }, { status: 400 })
    }

    const total = collections.reduce((s, c) => s + Number(c.amount), 0)
    const refs = collections.map((c) => c.transactionReference || c.collectionNo).join('، ')

    // إجمالي كل حساب وسيط على حدة — الخصم بيتم من نفس الحساب اللي المبلغ فيه
    const bySource = new Map<string, number>()
    for (const c of collections) {
      bySource.set(c.treasuryId, (bySource.get(c.treasuryId) || 0) + Number(c.amount))
    }

    await prisma.$transaction(async (tx) => {
      for (const [srcId, srcTotal] of bySource) {
        const srcName = srcId === clearing.id ? CLEARING_NAME : WALLET_CLEARING_NAME
        await applyTreasuryTxn(tx, {
          treasuryId: srcId,
          type: 'OUT',
          amount: srcTotal,
          refType: 'instapay-settle',
          reference: refs.slice(0, 190),
          description: `تسوية تحويلات إلى ${bank.name} (من ${srcName})`,
          createdById: session.user.id,
        })
      }
      await applyTreasuryTxn(tx, {
        treasuryId: bank.id,
        type: 'IN',
        amount: total,
        refType: 'instapay-settle',
        reference: refs.slice(0, 190),
        description: `مطابقة ${collections.length} تحويل إلكتروني (إنستا/محفظة) مع البنك`,
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
