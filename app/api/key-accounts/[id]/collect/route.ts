import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

// تحصيل من المقر الرئيسي — يقلّل المطالبات ويسجّل دفعة في سجل التحصيل والخزينة
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const amount = Number(b.amount)
    if (!amount || amount <= 0) return NextResponse.json({ error: 'أدخل مبلغ صحيح' }, { status: 400 })

    const acc = await prisma.keyAccount.findUnique({ where: { id: params.id } })
    if (!acc) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })
    const balanceBefore = Number(acc.balance)
    if (amount > balanceBefore) {
      return NextResponse.json({ error: `المبلغ أكبر من المطالبات المستحقة (${balanceBefore.toFixed(2)} ج.م)` }, { status: 400 })
    }
    const balanceAfter = balanceBefore - amount
    const count = await prisma.keyAccountPayment.count()

    const [, payment] = await prisma.$transaction([
      prisma.keyAccount.update({ where: { id: params.id }, data: { balance: { decrement: amount } } }),
      prisma.keyAccountPayment.create({
        data: {
          receiptNo: `RCP-${String(count + 1).padStart(4, '0')}`,
          keyAccountId: params.id,
          amount,
          method: b.method || 'نقدي',
          balanceBefore,
          balanceAfter,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تحصيل',
          description: `تحصيل ${amount.toFixed(2)} ج.م من ${acc.name}`,
          impact: `-${amount.toFixed(2)} ج.م من المطالبات`,
        },
      }),
    ])

    return NextResponse.json({ success: true, paymentId: payment.id })
  } catch {
    return NextResponse.json({ error: 'فشل التحصيل' }, { status: 500 })
  }
}
