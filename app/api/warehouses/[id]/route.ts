import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    const { name, location, isDefault } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المخزن مطلوب' }, { status: 400 })
    }
    const warehouse = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.warehouse.updateMany({ data: { isDefault: false } })
      }
      return tx.warehouse.update({
        where: { id: params.id },
        data: { name: name.trim(), location, isDefault: !!isDefault },
      })
    })
    return NextResponse.json(warehouse)
  } catch {
    return NextResponse.json({ error: 'Failed to update warehouse' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    // منع حذف مخزن لسه فيه بضاعة
    const stockCount = await prisma.productStock.aggregate({
      where: { warehouseId: params.id },
      _sum: { quantity: true },
    })
    if ((stockCount._sum.quantity || 0) > 0) {
      return NextResponse.json(
        { error: 'مينفعش حذف مخزن لسه فيه بضاعة — انقل الرصيد الأول' },
        { status: 400 }
      )
    }
    const wh = await prisma.warehouse.findUnique({ where: { id: params.id } })
    if (wh?.isDefault) {
      return NextResponse.json({ error: 'مينفعش حذف المخزن الافتراضي' }, { status: 400 })
    }
    await prisma.warehouse.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete warehouse' }, { status: 500 })
  }
}
