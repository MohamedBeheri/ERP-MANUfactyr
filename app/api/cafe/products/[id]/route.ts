import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('cafe', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    const b = await req.json()
    await prisma.product.update({
      where: { id: params.id },
      data: {
        name: b.name?.trim() || undefined,
        categoryId: b.categoryId !== undefined ? b.categoryId || null : undefined,
        costPrice: b.costPrice !== undefined ? Number(b.costPrice) || 0 : undefined,
        sellPrice: b.sellPrice !== undefined ? Number(b.sellPrice) || 0 : undefined,
        minStock: b.minStock !== undefined ? Number(b.minStock) || 0 : undefined,
        unit: b.unit || undefined,
      },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل تعديل الصنف' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('cafe', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    await prisma.product.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف الصنف' }, { status: 500 })
  }
}
