import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { ensureUnits } from '@/lib/units'

export async function GET() {
  const auth = await requirePermission('settings', 'view')
  if ('response' in auth) return auth.response

  await ensureUnits()
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(units)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('settings', 'add')
  if ('response' in auth) return auth.response

  try {
    const { name, sortOrder } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الوحدة مطلوب' }, { status: 400 })
    }
    const unit = await prisma.unit.create({
      data: { name: name.trim(), sortOrder: Number(sortOrder) || 0 },
    })
    return NextResponse.json(unit, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'الوحدة دي موجودة بالفعل' }, { status: 400 })
    }
    return NextResponse.json({ error: 'فشل إضافة الوحدة' }, { status: 500 })
  }
}
