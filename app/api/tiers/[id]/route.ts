import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response
  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: 'اسم الفئة مطلوب' }, { status: 400 })
    const tier = await prisma.customerTier.update({
      where: { id: params.id },
      data: {
        name: b.name.trim(),
        priceSource: b.priceSource === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        discountPercent: Math.min(100, Math.max(0, Number(b.discountPercent) || 0)),
        bonusPercent: Math.min(100, Math.max(0, Number(b.bonusPercent) || 0)),
        sortOrder: b.sortOrder !== undefined ? Number(b.sortOrder) : undefined,
      },
    })
    return NextResponse.json(tier)
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'الفئة دي موجودة بالفعل' }, { status: 400 })
    return NextResponse.json({ error: 'فشل تعديل الفئة' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response
  try {
    await prisma.$transaction([
      prisma.customer.updateMany({ where: { tierId: params.id }, data: { tierId: null } }),
      prisma.customerTier.update({ where: { id: params.id }, data: { isActive: false } }),
    ])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف الفئة' }, { status: 500 })
  }
}
