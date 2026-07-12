import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const { name, sortOrder } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المرحلة مطلوب' }, { status: 400 })
    }
    const stage = await prisma.productionStage.update({
      where: { id: params.id },
      data: { name: name.trim(), sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined },
    })
    return NextResponse.json(stage)
  } catch {
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    await prisma.productionStage.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete stage' }, { status: 500 })
  }
}
