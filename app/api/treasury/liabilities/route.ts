import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response

  const status = req.nextUrl.searchParams.get('status')
  const type = req.nextUrl.searchParams.get('type')

  const liabilities = await prisma.liability.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(type ? { type: type as any } : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      installments: { orderBy: { installmentNo: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(liabilities)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json()
  const { type, creditor, totalAmount, interestRate, startDate, dueDate, notes, installmentsCount } = body

  if (!type || !creditor || !totalAmount || totalAmount <= 0) {
    return NextResponse.json({ error: 'النوع والجهة الدائنة والمبلغ مطلوبين' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.liability.count({
    where: { liabilityNo: { startsWith: `LIB-${today}` } },
  })
  const liabilityNo = `LIB-${today}-${String(count + 1).padStart(3, '0')}`

  // توليد أقساط تلقائي لو المستخدم حدد عددهم
  const installments: { installmentNo: number; amount: number; dueDate: Date }[] = []
  if (installmentsCount && installmentsCount > 0) {
    const perInstallment = Math.round((totalAmount / installmentsCount) * 100) / 100
    const start = new Date(startDate || Date.now())
    for (let i = 0; i < installmentsCount; i++) {
      const due = new Date(start)
      due.setMonth(due.getMonth() + i + 1)
      installments.push({
        installmentNo: i + 1,
        amount: i === installmentsCount - 1 ? totalAmount - perInstallment * i : perInstallment,
        dueDate: due,
      })
    }
  }

  const liability = await prisma.liability.create({
    data: {
      liabilityNo,
      type,
      creditor,
      totalAmount,
      remainingAmount: totalAmount,
      interestRate: interestRate || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes,
      createdById: (session.user as any).id,
      installments: installments.length > 0 ? { create: installments } : undefined,
    },
    include: {
      installments: { orderBy: { installmentNo: 'asc' } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(liability, { status: 201 })
}
