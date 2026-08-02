import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { getCafeStageIds } from '@/lib/cafe'

export async function POST(req: NextRequest) {
  const auth = await requirePermission('cafe', 'add')
  if ('response' in auth) return auth.response

  try {
    const body = await req.json()
    const { name, kind, categoryId, costPrice, sellPrice, minStock, unit } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الصنف مطلوب' }, { status: 400 })
    }
    if (!['material', 'item'].includes(kind)) {
      return NextResponse.json({ error: 'نوع الصنف غير صحيح' }, { status: 400 })
    }

    const { materialsStageId, itemsStageId } = await getCafeStageIds()

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        type: kind === 'material' ? 'RAW' : 'FINISHED',
        itemKind: kind === 'material' ? 'CAFE_MATERIAL' : 'CAFE_ITEM',
        stageId: kind === 'material' ? materialsStageId : itemsStageId,
        categoryId: categoryId || null,
        costPrice: Number(costPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        minStock: Number(minStock) || 0,
        unit: unit || 'قطعة',
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'فشل إضافة الصنف' }, { status: 500 })
  }
}
