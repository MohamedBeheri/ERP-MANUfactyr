import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  try {
    const b = await req.json()
    const slide = await prisma.heroSlide.update({
      where: { id: params.id },
      data: {
        type: b.type ? (b.type === 'VIDEO' ? 'VIDEO' : 'IMAGE') : undefined,
        media: b.media ?? undefined,
        badge: b.badge !== undefined ? b.badge || null : undefined,
        title1: b.title1 !== undefined ? b.title1 || null : undefined,
        title2: b.title2 !== undefined ? b.title2 || null : undefined,
        subtitle: b.subtitle !== undefined ? b.subtitle || null : undefined,
        ctaText: b.ctaText !== undefined ? b.ctaText || null : undefined,
        ctaLink: b.ctaLink ?? undefined,
        sortOrder: b.sortOrder !== undefined ? Number(b.sortOrder) : undefined,
      },
    })
    return NextResponse.json(slide)
  } catch {
    return NextResponse.json({ error: 'فشل تعديل الشريحة' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  try {
    await prisma.heroSlide.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف الشريحة' }, { status: 500 })
  }
}
