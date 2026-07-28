import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('delegates', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    const b = await req.json()
    const { name, phone, carNumber, area, route, commissionRate } = b
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المندوب مطلوب' }, { status: 400 })
    }
    const delegate = await prisma.delegate.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        phone,
        carNumber,
        area,
        route,
        commissionRate: commissionRate !== undefined ? Number(commissionRate) : undefined,
        vehicleId: b.vehicleId !== undefined ? b.vehicleId || null : undefined,
        userId: b.userId !== undefined ? b.userId || null : undefined,
      },
    })
    return NextResponse.json(delegate)
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'حساب الدخول ده مربوط بمندوب تاني' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update delegate' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('delegates', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    // منع الحذف لو عنده جولة شغالة
    const activeOrders = await prisma.deliveryOrder.count({
      where: { delegateId: params.id, status: 'IN_PROGRESS' },
    })
    if (activeOrders > 0) {
      return NextResponse.json({ error: 'المندوب عنده جولة شغالة — سوّيها الأول' }, { status: 400 })
    }
    await prisma.delegate.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete delegate' }, { status: 500 })
  }
}
