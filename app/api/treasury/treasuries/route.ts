import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { ensureTreasuries } from '@/lib/treasuries'

export async function GET() {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response

  await ensureTreasuries()
  const treasuries = await prisma.treasury.findMany({
    where: { isActive: true },
    include: { delegate: { select: { id: true, name: true } } },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(treasuries)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: 'اسم الخزنة مطلوب' }, { status: 400 })
    const type = ['SALESMAN_CASH', 'MAIN_CASH', 'CLEARING_ACCOUNT', 'BANK'].includes(b.type) ? b.type : 'MAIN_CASH'
    const treasury = await prisma.treasury.create({
      data: {
        name: b.name.trim(),
        type,
        allowExpenseDisbursement: !!b.allowExpenseDisbursement,
        delegateId: b.delegateId || null,
      },
    })
    return NextResponse.json(treasury, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إنشاء الخزنة' }, { status: 500 })
  }
}
