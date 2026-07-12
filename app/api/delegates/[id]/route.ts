import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const { name, phone, carNumber, area, route, commissionRate } = await req.json()
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
      },
    })
    return NextResponse.json(delegate)
  } catch {
    return NextResponse.json({ error: 'Failed to update delegate' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

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
