import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const delegates = await prisma.delegate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(delegates)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch delegates' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const body = await req.json()
    const { name, phone, carNumber, area, route, commissionRate } = body

    if (!name) {
      return NextResponse.json({ error: 'اسم المندوب مطلوب' }, { status: 400 })
    }

    const delegate = await prisma.delegate.create({
      data: {
        name, phone, carNumber, area, route,
        commissionRate: commissionRate ?? 5,
        vehicleId: body.vehicleId || null,
        userId: body.userId || null,
      },
    })

    return NextResponse.json(delegate, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'حساب الدخول ده مربوط بمندوب تاني' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to create delegate' }, { status: 500 })
  }
}
