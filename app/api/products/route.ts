import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { attachmentTooLarge } from '@/lib/security'


export async function GET() {
  const auth = await requirePermission('catalog', 'view')
  if ('response' in auth) return auth.response

  try {
    const products = await prisma.product.findMany({
      include: { category: true, stocks: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('catalog', 'add')
  if ('response' in auth) return auth.response

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


    const product = await prisma.product.create({
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

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
