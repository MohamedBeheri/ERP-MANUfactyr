import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const accounts = await prisma.keyAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        branches: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        _count: { select: { branches: true, quotes: true } },
      },
    })
    return NextResponse.json(accounts)
  } catch {
    return NextResponse.json({ error: 'فشل جلب كبار الموردين' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 })

    const account = await prisma.keyAccount.create({
      data: {
        name: b.name.trim(),
        brandName: b.brandName?.trim() || null,
        activityType: b.activityType?.trim() || null,
        phone: b.phone?.trim() || null,
        address: b.address?.trim() || null,
        notes: b.notes?.trim() || null,
      },
    })
    return NextResponse.json(account, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إضافة العميل' }, { status: 500 })
  }
}
