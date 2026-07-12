import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const { name, phone, address, email, rating } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })
    }
    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: { name: name.trim(), phone, address, email, rating: rating ? Number(rating) : undefined },
    })
    return NextResponse.json(supplier)
  } catch {
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    // حذف ناعم للحفاظ على سجل فواتير الشراء المرتبطة
    await prisma.supplier.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
