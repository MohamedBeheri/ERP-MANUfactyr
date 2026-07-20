import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  try {
    const b = await req.json()
    const block = await prisma.storeBlock.update({
      where: { id: params.id },
      data: {
        title: b.title?.trim() || undefined,
        subtitle: b.subtitle !== undefined ? b.subtitle || null : undefined,
        imageUrl: b.imageUrl !== undefined ? b.imageUrl || null : undefined,
        link: b.link !== undefined ? b.link || null : undefined,
        rating: b.rating !== undefined ? Math.min(5, Math.max(1, Number(b.rating) || 5)) : undefined,
        sortOrder: b.sortOrder !== undefined ? Number(b.sortOrder) : undefined,
      },
    })
    return NextResponse.json(block)
  } catch {
    return NextResponse.json({ error: 'فشل تعديل البلوك' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  try {
    await prisma.storeBlock.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 })
  }
}
