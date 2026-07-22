import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// تسديد دفعة للمورد — يقلّل المستحق ويسجّل في سجل التسديد
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const amount = Number(b.amount)
    if (!amount || amount <= 0) return NextResponse.json({ error: 'أدخل مبلغ صحيح' }, { status: 400 })

    const sup = await prisma.supplier.findUnique({ where: { id: params.id } })
    if (!sup) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    const balanceBefore = Number(sup.balance)
    if (amount > balanceBefore) {
      return NextResponse.json({ error: `المبلغ أكبر من المستحق (${balanceBefore.toFixed(2)} ج.م)` }, { status: 400 })
    }
    const balanceAfter = balanceBefore - amount
    const count = await prisma.supplierPayment.count()

    const [, payment] = await prisma.$transaction([
      prisma.supplier.update({ where: { id: params.id }, data: { balance: { decrement: amount } } }),
      prisma.supplierPayment.create({
        data: {
          receiptNo: `SP-${String(count + 1).padStart(4, '0')}`,
          supplierId: params.id,
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
          action: 'تسديد مورد',
          description: `تسديد ${amount.toFixed(2)} ج.م للمورد ${sup.name}`,
          impact: `-${amount.toFixed(2)} من المستحق`,
        },
      }),
    ])

    return NextResponse.json({ success: true, paymentId: payment.id })
  } catch {
    return NextResponse.json({ error: 'فشل التسديد' }, { status: 500 })
  }
}
