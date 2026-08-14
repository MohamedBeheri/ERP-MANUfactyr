import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response

  const status = req.nextUrl.searchParams.get('status')
  const delegateId = req.nextUrl.searchParams.get('delegateId')

  const settlements = await prisma.treasurySettlement.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(delegateId ? { delegateId } : {}),
    },
    include: {
      delegate: true,
      warehouse: { select: { id: true, name: true } },
      deliveryOrder: { select: { id: true, orderNo: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      acceptedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(settlements)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json()
  const { delegateId, amount, method, checkNo, bankName, notes } = body

  if (!delegateId || !amount || amount <= 0) {
    return NextResponse.json({ error: 'delegateId و amount مطلوبين' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.treasurySettlement.count({
    where: { settlementNo: { startsWith: `TRS-${today}` } },
  })
  const settlementNo = `TRS-${today}-${String(count + 1).padStart(3, '0')}`

  const settlement = await prisma.treasurySettlement.create({
    data: {
      settlementNo,
      delegateId,
      amount,
      method: method || 'CASH',
      checkNo,
      bankName,
      notes,
      createdById: (session.user as any).id,
    },
    include: { delegate: true, createdBy: { select: { id: true, name: true } } },
  })

  return NextResponse.json(settlement, { status: 201 })
}
