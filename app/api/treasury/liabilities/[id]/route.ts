import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  const liability = await prisma.liability.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      installments: { orderBy: { installmentNo: 'asc' }, include: { paidBy: { select: { id: true, name: true } } } },
    },
  })
  if (!liability) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(liability)
}

export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  const body = await req.json()
  const { creditor, totalAmount, interestRate, dueDate, notes, status } = body

  const existing = await prisma.liability.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.liability.update({
    where: { id: params.id },
    data: {
      ...(creditor !== undefined ? { creditor } : {}),
      ...(totalAmount !== undefined ? { totalAmount, remainingAmount: totalAmount - Number(existing.paidAmount) } : {}),
      ...(interestRate !== undefined ? { interestRate } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(status !== undefined ? { status } : {}),
    },
    include: { installments: { orderBy: { installmentNo: 'asc' } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  await prisma.liability.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
