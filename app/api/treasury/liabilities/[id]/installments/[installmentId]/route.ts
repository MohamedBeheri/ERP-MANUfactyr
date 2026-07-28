import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

// سداد قسط
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; installmentId: string } }
) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json()
  const { paidAmount, notes } = body

  const installment = await prisma.installment.findUnique({
    where: { id: params.installmentId },
    include: { liability: true },
  })
  if (!installment) return NextResponse.json({ error: 'القسط غير موجود' }, { status: 404 })
  if (installment.liabilityId !== params.id) {
    return NextResponse.json({ error: 'القسط لا ينتمي لهذا الالتزام' }, { status: 400 })
  }

  const payAmount = paidAmount || Number(installment.amount)
  const newPaid = Number(installment.paidAmount) + payAmount
  const fullyPaid = newPaid >= Number(installment.amount)

  const [updatedInstallment] = await prisma.$transaction([
    prisma.installment.update({
      where: { id: params.installmentId },
      data: {
        paidAmount: newPaid,
        status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
        paidDate: fullyPaid ? new Date() : null,
        paidById: (session.user as any).id,
        ...(notes !== undefined ? { notes } : {}),
      },
    }),
    // تحديث المبالغ على الالتزام الأب
    prisma.liability.update({
      where: { id: params.id },
      data: {
        paidAmount: { increment: payAmount },
        remainingAmount: { decrement: payAmount },
      },
    }),
    // تسجيل في التدفق النقدي
    prisma.cashFlow.create({
      data: {
        description: `سداد قسط ${installment.installmentNo} — ${installment.liability.creditor}`,
        type: 'OUT',
        amount: payAmount,
        balance: 0,
        reference: installment.liability.liabilityNo,
      },
    }),
  ])

  // لو كل الأقساط مدفوعة — حدّث حالة الالتزام
  const allInstallments = await prisma.installment.findMany({
    where: { liabilityId: params.id },
  })
  const allPaid = allInstallments.every((i) => i.status === 'PAID')
  if (allPaid) {
    await prisma.liability.update({
      where: { id: params.id },
      data: { status: 'SETTLED' },
    })
  }

  return NextResponse.json(updatedInstallment)
}
