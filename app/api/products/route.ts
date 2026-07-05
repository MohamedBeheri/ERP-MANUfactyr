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
    const { name, type, costPrice, sellPrice, minStock, unit } = body

    const product = await prisma.product.create({
      data: { name, type, costPrice, sellPrice, minStock, unit },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
