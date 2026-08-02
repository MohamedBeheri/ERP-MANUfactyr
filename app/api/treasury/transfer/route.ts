import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { applyTreasuryTxn } from '@/lib/treasuries'

// نقل بين خزنتين — يُستخدم لتصفية كاش المندوب للخزنة العمومية
export async function POST(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const amount = Number(b.amount)
    if (!b.sourceTreasuryId || !b.targetTreasuryId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'الخزنة المصدر والهدف والمبلغ مطلوبين' }, { status: 400 })
    }
    if (b.sourceTreasuryId === b.targetTreasuryId) {
      return NextResponse.json({ error: 'لا يمكن التحويل لنفس الخزنة' }, { status: 400 })
    }

    const [source, target] = await Promise.all([
      prisma.treasury.findUnique({ where: { id: b.sourceTreasuryId } }),
      prisma.treasury.findUnique({ where: { id: b.targetTreasuryId } }),
    ])
    if (!source || !target) return NextResponse.json({ error: 'خزنة غير موجودة' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      await applyTreasuryTxn(tx, {
        treasuryId: source.id,
        type: 'OUT',
        amount,
        refType: 'transfer',
        description: `تحويل إلى ${target.name}${b.notes ? ` — ${b.notes}` : ''}`,
        createdById: session.user.id,
      })
      await applyTreasuryTxn(tx, {
        treasuryId: target.id,
        type: 'IN',
        amount,
        refType: 'transfer',
        description: `تحويل من ${source.name}${b.notes ? ` — ${b.notes}` : ''}`,
        createdById: session.user.id,
      })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تحويل خزنة',
          description: `${source.name} ← ${target.name}`,
          impact: `${amount.toFixed(2)} ج.م`,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل التحويل' }, { status: 500 })
  }
}
