import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { ensureTiers } from '@/lib/tiers'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  await ensureTiers()
  const tiers = await prisma.customerTier.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { customers: true } } },
  })
  return NextResponse.json(tiers)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response
  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: 'اسم الفئة مطلوب' }, { status: 400 })
    const tier = await prisma.customerTier.create({
      data: {
        name: b.name.trim(),
        priceSource: b.priceSource === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        discountPercent: Math.min(100, Math.max(0, Number(b.discountPercent) || 0)),
        bonusPercent: Math.min(100, Math.max(0, Number(b.bonusPercent) || 0)),
        sortOrder: Number(b.sortOrder) || 0,
      },
    })
    return NextResponse.json(tier, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'الفئة دي موجودة بالفعل' }, { status: 400 })
    return NextResponse.json({ error: 'فشل إنشاء الفئة' }, { status: 500 })
  }
}
