import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAnyPermission } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPermission(['delegates', 'sales'], 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams
  try {
    const b = await req.json()
    const route = await prisma.salesRoute.update({
      where: { id: params.id },
      data: {
        name: b.name !== undefined ? b.name.trim() : undefined,
        notes: b.notes !== undefined ? b.notes?.trim() || null : undefined,
        dayOfWeek: b.dayOfWeek !== undefined ? (b.dayOfWeek === '' || b.dayOfWeek == null ? null : Number(b.dayOfWeek)) : undefined,
        delegateId: b.delegateId !== undefined ? b.delegateId || null : undefined,
        sortOrder: b.sortOrder !== undefined ? Number(b.sortOrder) || 0 : undefined,
        isActive: b.isActive !== undefined ? !!b.isActive : undefined,
      },
    })
    return NextResponse.json(route)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تعديل خط السير' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPermission(['delegates', 'sales'], 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams
  try {
    // فك ربط العملاء ثم تعطيل خط السير (حفاظًا على السجلات)
    await prisma.customer.updateMany({ where: { salesRouteId: params.id }, data: { salesRouteId: null } })
    await prisma.salesRoute.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل حذف خط السير' }, { status: 500 })
  }
}
