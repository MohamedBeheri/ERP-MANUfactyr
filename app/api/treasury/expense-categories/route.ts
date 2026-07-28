import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { ensureExpenseCategories } from '@/lib/expense-categories'


export async function GET(req: NextRequest) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response

  await ensureExpenseCategories()

  const includeInactive = req.nextUrl.searchParams.get('all') === '1'
  const where = includeInactive ? {} : { isActive: true }

  const categories = await prisma.expenseCategory.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      parent: { select: { id: true, name: true } },
      children: {
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, code: true, activity: true, affectsPL: true, isActive: true, sortOrder: true },
      },
      _count: { select: { vouchers: true } },
    },
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response

  const body = await req.json()
  const { name, code, activity, affectsPL, parentId, sortOrder } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'اسم البند مطلوب' }, { status: 400 })
  }

  if (code) {
    const existing = await prisma.expenseCategory.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'الكود مستخدم بالفعل' }, { status: 400 })
    }
  }

  const cat = await prisma.expenseCategory.create({
    data: {
      name: name.trim(),
      code: code?.trim() || null,
      activity: activity || 'OPERATING',
      affectsPL: affectsPL !== undefined ? affectsPL : activity === 'OPERATING',
      parentId: parentId || null,
      sortOrder: sortOrder ?? 0,
    },
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
      _count: { select: { vouchers: true } },
    },
  })

  return NextResponse.json(cat, { status: 201 })
}
