import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getDefaultWarehouseId } from '@/lib/warehouse'

const ALLOWED_ROLES = ['ADMIN', 'WAREHOUSE'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES, 'FACTORY', 'SALES'])
  if ('response' in auth) return auth.response

  try {
    await getDefaultWarehouseId() // يضمن وجود مخزن افتراضي
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { stocks: true } } },
    })
    return NextResponse.json(warehouses)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
      return tx.warehouse.create({
        data: { name: name.trim(), location, isDefault: !!isDefault },
      })
    })
    return NextResponse.json(warehouse, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'المخزن ده موجود بالفعل' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 })
  }
}
