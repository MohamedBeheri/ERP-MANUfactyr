import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN', 'WAREHOUSE'])
  if ('response' in auth) return auth.response

  try {
    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم التصنيف مطلوب' }, { status: 400 })
    }
    const category = await prisma.category.update({
      where: { id: params.id },
      data: { name: name.trim() },
    })
    return NextResponse.json(category)
  } catch {
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    await prisma.$transaction([
      // فك ربط المنتجات قبل التعطيل
      prisma.product.updateMany({ where: { categoryId: params.id }, data: { categoryId: null } }),
      prisma.category.update({ where: { id: params.id }, data: { isActive: false } }),
    ])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
