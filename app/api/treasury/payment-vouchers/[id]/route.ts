import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  const voucher = await prisma.paymentVoucher.findUnique({
    where: { id: params.id },
    include: {
      liability: true,
      installment: true,
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      cashFlows: true,
    },
  })
  if (!voucher) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(voucher)
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  const voucher = await prisma.paymentVoucher.findUnique({ where: { id: params.id } })
  if (!voucher) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (voucher.status !== 'DRAFT') {
    return NextResponse.json({ error: 'لا يمكن حذف سند معتمد' }, { status: 400 })
  }

  await prisma.paymentVoucher.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
