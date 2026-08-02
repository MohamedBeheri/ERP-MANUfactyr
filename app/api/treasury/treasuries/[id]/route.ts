import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

// PUT: تعديل خزنة (تفعيل/إيقاف صلاحية الصرف — الاسم)
export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    const b = await req.json()
    const treasury = await prisma.treasury.update({
      where: { id: params.id },
      data: {
        name: b.name?.trim() || undefined,
        allowExpenseDisbursement: b.allowExpenseDisbursement !== undefined ? !!b.allowExpenseDisbursement : undefined,
        isActive: b.isActive !== undefined ? !!b.isActive : undefined,
      },
    })
    return NextResponse.json(treasury)
  } catch {
    return NextResponse.json({ error: 'فشل تعديل الخزنة' }, { status: 500 })
  }
}

// GET: كشف حساب الخزنة (دفتر الأستاذ)
export async function GET(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  const where: any = { treasuryId: params.id }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59')
  }

  const [treasury, transactions] = await Promise.all([
    prisma.treasury.findUnique({ where: { id: params.id }, include: { delegate: { select: { name: true } } } }),
    prisma.treasuryTransaction.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])
  if (!treasury) return NextResponse.json({ error: 'الخزنة غير موجودة' }, { status: 404 })

  return NextResponse.json({ treasury, transactions })
}
