import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'WAREHOUSE', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json(categories)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'WAREHOUSE'])
  if ('response' in auth) return auth.response

  try {
    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم التصنيف مطلوب' }, { status: 400 })
    }
    const category = await prisma.category.create({ data: { name: name.trim() } })
    return NextResponse.json(category, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'التصنيف ده موجود بالفعل' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
