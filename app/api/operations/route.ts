import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const operations = await prisma.productionOperation.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { inputStage: true, outputStage: true },
    })
    return NextResponse.json(operations)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
    const operation = await prisma.productionOperation.create({
      data: {
        name: name.trim(),
        inputStageId,
        outputStageId,
        hasYieldLoss: !!hasYieldLoss,
        sortOrder: Number(sortOrder) || 0,
      },
      include: { inputStage: true, outputStage: true },
    })
    return NextResponse.json(operation, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'العملية دي موجودة بالفعل' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to create operation' }, { status: 500 })
  }
}
