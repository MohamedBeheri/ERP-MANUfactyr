import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('settings', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    const { name, sortOrder } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الوحدة مطلوب' }, { status: 400 })
    }
    const unit = await prisma.unit.update({
      where: { id: params.id },
      data: { name: name.trim(), sortOrder: sortOrder !== undefined ? Number(sortOrder) || 0 : undefined },
    })
    return NextResponse.json(unit)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'الوحدة دي موجودة بالفعل' }, { status: 400 })
    }
    return NextResponse.json({ error: 'فشل تعديل الوحدة' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('settings', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    const unit = await prisma.unit.findUnique({ where: { id: params.id } })
    if (!unit) return NextResponse.json({ error: 'الوحدة غير موجودة' }, { status: 404 })

    const inUse = await prisma.product.count({ where: { unit: unit.name, isActive: true } })
    if (inUse > 0) {
      return NextResponse.json({ error: `مينفعش حذف الوحدة — مستخدمة في ${inUse} صنف` }, { status: 400 })
    }
    await prisma.unit.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف الوحدة' }, { status: 500 })
  }
}
