import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const { name, inputStageId, outputStageId, hasYieldLoss, sortOrder } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم العملية مطلوب' }, { status: 400 })
    }
    if (!inputStageId || !outputStageId) {
      return NextResponse.json({ error: 'حدد المرحلة اللي بتسحب منها واللي بتنتج فيها' }, { status: 400 })
    }
    const operation = await prisma.productionOperation.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        inputStageId,
        outputStageId,
        hasYieldLoss: hasYieldLoss !== undefined ? !!hasYieldLoss : undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      },
      include: { inputStage: true, outputStage: true },
    })
    return NextResponse.json(operation)
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'العملية دي موجودة بالفعل' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update operation' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    await prisma.productionOperation.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete operation' }, { status: 500 })
  }
}
