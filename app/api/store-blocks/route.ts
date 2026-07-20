import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const
const KINDS = ['ROAST_CARD', 'BRAND_CARD', 'LOYALTY_STEP', 'REVIEW']

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const blocks = await prisma.storeBlock.findMany({
    where: { isActive: true },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(blocks)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!KINDS.includes(b.kind)) {
      return NextResponse.json({ error: 'نوع البلوك غير صحيح' }, { status: 400 })
    }
    if (!b.title?.trim()) {
      return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 })
    }
    const block = await prisma.storeBlock.create({
      data: {
        kind: b.kind,
        title: b.title.trim(),
        subtitle: b.subtitle || null,
        imageUrl: b.imageUrl || null,
        link: b.link || null,
        rating: Math.min(5, Math.max(1, Number(b.rating) || 5)),
        sortOrder: Number(b.sortOrder) || 0,
      },
    })
    return NextResponse.json(block, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إضافة البلوك' }, { status: 500 })
  }
}
