import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const slides = await prisma.heroSlide.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(slides)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.media?.trim()) {
      return NextResponse.json({ error: 'لازم صورة أو رابط فيديو' }, { status: 400 })
    }
    const slide = await prisma.heroSlide.create({
      data: {
        type: b.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
        media: b.media,
        badge: b.badge || null,
        title1: b.title1 || null,
        title2: b.title2 || null,
        subtitle: b.subtitle || null,
        ctaText: b.ctaText || null,
        ctaLink: b.ctaLink || '/store',
        sortOrder: Number(b.sortOrder) || 0,
      },
    })
    return NextResponse.json(slide, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إضافة الشريحة' }, { status: 500 })
  }
}
