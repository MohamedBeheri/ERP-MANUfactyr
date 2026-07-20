import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const WRITE_ROLES = ['ADMIN', 'WAREHOUSE'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...WRITE_ROLES])
  if ('response' in auth) return auth.response

  try {
    const body = await req.json()
    const { name, categoryId, stageId, costPrice, sellPrice, oldPrice, wholesalePrice, minStock, unit, imageUrl } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الصنف مطلوب' }, { status: 400 })
    }

    // النوع بيتحدد من المرحلة المخزنية: لو بتتشرى = خام، غير كده = نهائي
    let derivedType: 'RAW' | 'FINISHED' = 'FINISHED'
    if (stageId) {
      const stage = await prisma.stockStage.findUnique({ where: { id: stageId } })
      if (stage?.purchasable) derivedType = 'RAW'
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        type: derivedType,
        categoryId: categoryId || null,
        stageId: stageId || null,
        costPrice: Number(costPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        oldPrice: oldPrice ? Number(oldPrice) : null,
        wholesalePrice: Number(wholesalePrice) || 0,
        minStock: Number(minStock) || 0,
        unit: unit || 'كجم',
        imageUrl: imageUrl || null,
      },
    })

    return NextResponse.json(product)
  } catch {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    const product = await prisma.product.findUnique({ where: { id: params.id } })
    if (product && product.quantity > 0) {
      return NextResponse.json(
        { error: 'مينفعش حذف صنف لسه فيه رصيد — اصرفه أو سوّيه بالجرد الأول' },
        { status: 400 }
      )
    }
    // حذف ناعم للحفاظ على الفواتير والحركات المرتبطة
    await prisma.product.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
