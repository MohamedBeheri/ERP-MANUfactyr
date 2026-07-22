import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES', 'DELEGATE'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(customers)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const body = await req.json()
    const { name, phone, address, area, activityType, type, customerType, creditLimit, tierId } = body

    if (!name) {
      return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 })
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone: phone || null,
        address: address || null,
        area: area || null,
        activityType: activityType || null,
        tierId: tierId || null,
        type: type || 'CASH',
        customerType: customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        creditLimit: creditLimit || 0,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
