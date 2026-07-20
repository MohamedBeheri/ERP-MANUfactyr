import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN', 'WAREHOUSE'])
  if ('response' in auth) return auth.response

  try {
    const { name, sortOrder, sellable, purchasable, warehouseId } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المرحلة مطلوب' }, { status: 400 })
    }
    const stage = await prisma.stockStage.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        sellable: sellable !== undefined ? !!sellable : undefined,
        purchasable: purchasable !== undefined ? !!purchasable : undefined,
        warehouseId: warehouseId !== undefined ? warehouseId || null : undefined,
      },
    })
    return NextResponse.json(stage)
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'المرحلة دي موجودة بالفعل' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update stock stage' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    const count = await prisma.product.count({ where: { stageId: params.id, isActive: true } })
    if (count > 0) {
      return NextResponse.json(
        { error: `فيه ${count} صنف على المرحلة دي — انقلهم لمرحلة تانية الأول` },
        { status: 400 }
      )
    }
    await prisma.stockStage.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete stock stage' }, { status: 500 })
  }
}
