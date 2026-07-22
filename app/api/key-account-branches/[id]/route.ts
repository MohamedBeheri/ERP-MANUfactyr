import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    const branch = await prisma.keyAccountBranch.update({
      where: { id: params.id },
      data: {
        name: b.name?.trim() || undefined,
        address: b.address !== undefined ? b.address?.trim() || null : undefined,
        phone: b.phone !== undefined ? b.phone?.trim() || null : undefined,
        manager: b.manager !== undefined ? b.manager?.trim() || null : undefined,
      },
    })
    return NextResponse.json(branch)
  } catch {
    return NextResponse.json({ error: 'فشل تعديل الفرع' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    await prisma.keyAccountBranch.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف الفرع' }, { status: 500 })
  }
}
