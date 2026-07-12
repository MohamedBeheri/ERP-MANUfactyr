import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALL_ROLES = ['ADMIN', 'FACTORY', 'WAREHOUSE', 'SALES', 'ACCOUNTANT'] as const
const WRITE_ROLES = ['ADMIN', 'WAREHOUSE'] as const

export async function GET() {
  const auth = await requireRole([...ALL_ROLES])
  if ('response' in auth) return auth.response

  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...WRITE_ROLES])
  if ('response' in auth) return auth.response

  try {
    const body = await req.json()
    const { name, type, categoryId, costPrice, sellPrice, wholesalePrice, minStock, unit, imageUrl } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الصنف مطلوب' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        type: type === 'RAW' ? 'RAW' : 'FINISHED',
        categoryId: categoryId || null,
        costPrice: Number(costPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        wholesalePrice: Number(wholesalePrice) || 0,
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
