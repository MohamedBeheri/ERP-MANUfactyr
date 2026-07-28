import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response

  const activity = req.nextUrl.searchParams.get('activity')
  const status = req.nextUrl.searchParams.get('status')

  const vouchers = await prisma.paymentVoucher.findMany({
    where: {
      ...(activity ? { activity: activity as any } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      category: { select: { id: true, name: true, code: true, activity: true } },
      liability: { select: { id: true, liabilityNo: true, creditor: true, type: true } },
      installment: { select: { id: true, installmentNo: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(vouchers)
}

function liabilityTypeToActivity(type: string): 'OPERATING' | 'INVESTING' | 'FINANCING' {
  switch (type) {
    case 'REAL_ESTATE':
    case 'INSURANCE':
      return 'INVESTING'
    case 'LOAN':
    case 'FINANCING_COMPANY':
      return 'FINANCING'
    default:
      return 'OPERATING'
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json()
  const { description, amount, categoryId, liabilityId, installmentId, paymentMethod, checkNo, bankName, notes, activity: manualActivity } = body

  if (!description || !amount || amount <= 0) {
    return NextResponse.json({ error: 'الوصف والمبلغ مطلوبين' }, { status: 400 })
  }

  let activity: 'OPERATING' | 'INVESTING' | 'FINANCING' = manualActivity || 'OPERATING'
  let liability = null

  if (categoryId && !manualActivity) {
    const cat = await prisma.expenseCategory.findUnique({ where: { id: categoryId } })
    if (cat) activity = cat.activity
  }

  if (liabilityId) {
    liability = await prisma.liability.findUnique({ where: { id: liabilityId } })
    if (!liability) return NextResponse.json({ error: 'الالتزام غير موجود' }, { status: 404 })
    if (!manualActivity && !categoryId) {
      activity = liabilityTypeToActivity(liability.type)
    }
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.paymentVoucher.count({
    where: { voucherNo: { startsWith: `PV-${today}` } },
  })
  const voucherNo = `PV-${today}-${String(count + 1).padStart(3, '0')}`

  const voucher = await prisma.$transaction(async (tx) => {
    const v = await tx.paymentVoucher.create({
      data: {
        voucherNo,
        description,
        amount,
        categoryId: categoryId || null,
        activity,
        status: 'APPROVED',
        liabilityId,
        installmentId,
        paymentMethod: paymentMethod || 'CASH',
        checkNo,
        bankName,
        notes,
        createdById: (session.user as any).id,
        approvedById: (session.user as any).id,
        approvedAt: new Date(),
      },
      include: {
        liability: { select: { id: true, liabilityNo: true, creditor: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    await tx.cashFlow.create({
      data: {
        description: `سند صرف ${voucherNo} — ${description}`,
        type: 'OUT',
        amount,
        balance: 0,
        reference: voucherNo,
        activity,
        voucherId: v.id,
      },
    })

    if (installmentId) {
      const inst = await tx.installment.findUnique({ where: { id: installmentId } })
      if (inst) {
        const newPaid = Number(inst.paidAmount) + Number(amount)
        await tx.installment.update({
          where: { id: installmentId },
          data: {
            paidAmount: newPaid,
            paidDate: new Date(),
            status: newPaid >= Number(inst.amount) ? 'PAID' : 'PARTIALLY_PAID',
            paidById: (session.user as any).id,
          },
        })
      }
    }

    if (liabilityId) {
      const updatedInsts = await tx.installment.findMany({ where: { liabilityId } })
      const totalPaid = updatedInsts.reduce((s, i) => s + Number(i.paidAmount), 0)
      const lib = await tx.liability.findUnique({ where: { id: liabilityId } })
      if (lib) {
        const remaining = Number(lib.totalAmount) - totalPaid
        await tx.liability.update({
          where: { id: liabilityId },
          data: {
            paidAmount: totalPaid,
            remainingAmount: Math.max(0, remaining),
            status: remaining <= 0 ? 'SETTLED' : lib.status,
          },
        })
      }
    }

    return v
  })

  return NextResponse.json(voucher, { status: 201 })
}
