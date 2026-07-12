import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(suppliers)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const { name, phone, address, email, rating } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })
    }
    const supplier = await prisma.supplier.create({
      data: { name: name.trim(), phone, address, email, rating: rating ? Number(rating) : 5 },
    })
    return NextResponse.json(supplier, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }
}
