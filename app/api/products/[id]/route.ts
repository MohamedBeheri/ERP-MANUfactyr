import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { attachmentTooLarge } from '@/lib/security'


export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('catalog', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    const body = await req.json()
    const { name, categoryId, stageId, costPrice, sellPrice, oldPrice, wholesalePrice, minKeyPrice, minStock, unit, imageUrl } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الصنف مطلوب' }, { status: 400 })
    }

    // النوع بيتحدد من المرحلة المخزنية: لو بتتشرى = خام، غير كده = نهائي
    let derivedType: 'RAW' | 'FINISHED' = 'FINISHED'
    if (stageId) {
      const stage = await prisma.stockStage.findUnique({ where: { id: stageId } })
      if (stage?.purchasable) derivedType = 'RAW'
    }

    { const _e = attachmentTooLarge(imageUrl); if (_e) return NextResponse.json({ error: _e }, { status: 413 }) }


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
        minKeyPrice: Number(minKeyPrice) || 0,
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

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('catalog', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    const product = await prisma.product.findUnique({ where: { id: params.id } })
    if (product && Number(product.quantity) > 0) {
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
