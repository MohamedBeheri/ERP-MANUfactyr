import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { ensureStockStages } from '@/lib/stock-stages'

const READ_ROLES = ['ADMIN', 'FACTORY', 'WAREHOUSE', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...READ_ROLES])
  if ('response' in auth) return auth.response

  try {
    await ensureStockStages()
    const stages = await prisma.stockStage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json(stages)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stock stages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'WAREHOUSE'])
  if ('response' in auth) return auth.response

  try {
    const { name, sortOrder, sellable, purchasable } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المرحلة مطلوب' }, { status: 400 })
    }
    const stage = await prisma.stockStage.create({
      data: {
        name: name.trim(),
        sortOrder: Number(sortOrder) || 0,
        sellable: !!sellable,
        purchasable: !!purchasable,
      },
    })
    return NextResponse.json(stage, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'المرحلة دي موجودة بالفعل' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to create stock stage' }, { status: 500 })
  }
}
