import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAnyPermission } from '@/lib/api-auth'

// خطوط السير / نطاقات العربيات — يديرها مدير المبيعات
export async function GET() {
  const auth = await requireAnyPermission(['delegates', 'sales', 'customers'], 'view')
  if ('response' in auth) return auth.response
  const routes = await prisma.salesRoute.findMany({
    where: { isActive: true },
    include: { delegate: { select: { id: true, name: true } }, _count: { select: { customers: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(routes.map((r) => ({
    id: r.id, name: r.name, notes: r.notes, dayOfWeek: r.dayOfWeek,
    delegateId: r.delegateId, delegateName: r.delegate?.name || null, customersCount: r._count.customers,
  })))
}

export async function POST(req: NextRequest) {
  const auth = await requireAnyPermission(['delegates', 'sales'], 'add')
  if ('response' in auth) return auth.response
  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: 'اسم خط السير مطلوب' }, { status: 400 })
    const route = await prisma.salesRoute.create({
      data: {
        name: b.name.trim(),
        notes: b.notes?.trim() || null,
        dayOfWeek: b.dayOfWeek === '' || b.dayOfWeek == null ? null : Number(b.dayOfWeek),
        delegateId: b.delegateId || null,
        sortOrder: Number(b.sortOrder) || 0,
      },
    })
    return NextResponse.json(route, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل إنشاء خط السير' }, { status: 500 })
  }
}
