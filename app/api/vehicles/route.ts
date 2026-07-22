import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { delegates: { where: { isActive: true }, select: { id: true, name: true } } },
    })
    return NextResponse.json(vehicles)
  } catch {
    return NextResponse.json({ error: 'فشل جلب العربيات' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.plateNo?.trim()) return NextResponse.json({ error: 'رقم اللوحة مطلوب' }, { status: 400 })
    const vehicle = await prisma.vehicle.create({
      data: {
        plateNo: b.plateNo.trim(),
        model: b.model?.trim() || null,
        capacity: Number(b.capacity) || 0,
        notes: b.notes?.trim() || null,
      },
    })
    return NextResponse.json(vehicle, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'رقم اللوحة ده مسجّل قبل كده' }, { status: 400 })
    return NextResponse.json({ error: 'فشل إضافة العربية' }, { status: 500 })
  }
}
