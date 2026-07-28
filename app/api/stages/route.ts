import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET() {
  const auth = await requirePermission('settings', 'add')
  if ('response' in auth) return auth.response

  try {
    const stages = await prisma.productionStage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(stages)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('settings', 'add')
  if ('response' in auth) return auth.response

  try {
    const { name, sortOrder } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المرحلة مطلوب' }, { status: 400 })
    }
    const stage = await prisma.productionStage.create({
      data: { name: name.trim(), sortOrder: Number(sortOrder) || 0 },
    })
    return NextResponse.json(stage, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'المرحلة دي موجودة بالفعل' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 })
  }
}
