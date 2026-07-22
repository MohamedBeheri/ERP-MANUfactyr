import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    const vehicle = await prisma.vehicle.update({
      where: { id: params.id },
      data: {
        plateNo: b.plateNo?.trim() || undefined,
        model: b.model !== undefined ? b.model?.trim() || null : undefined,
        capacity: b.capacity !== undefined ? Number(b.capacity) || 0 : undefined,
        notes: b.notes !== undefined ? b.notes?.trim() || null : undefined,
      },
    })
    return NextResponse.json(vehicle)
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'رقم اللوحة ده مسجّل قبل كده' }, { status: 400 })
    return NextResponse.json({ error: 'فشل تعديل العربية' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    // فك ربط المناديب بالعربية ثم حذف ناعم
    await prisma.$transaction([
      prisma.delegate.updateMany({ where: { vehicleId: params.id }, data: { vehicleId: null } }),
      prisma.vehicle.update({ where: { id: params.id }, data: { isActive: false } }),
    ])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف العربية' }, { status: 500 })
  }
}
