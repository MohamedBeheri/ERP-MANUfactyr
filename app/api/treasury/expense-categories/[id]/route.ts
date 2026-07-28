import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response

  const cat = await prisma.expenseCategory.findUnique({ where: { id: params.id } })
  if (!cat) return NextResponse.json({ error: 'البند غير موجود' }, { status: 404 })

  const body = await req.json()
  const { name, code, activity, affectsPL, parentId, isActive, sortOrder } = body

  if (code && code !== cat.code) {
    const existing = await prisma.expenseCategory.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'الكود مستخدم بالفعل' }, { status: 400 })
    }
  }

  const updated = await prisma.expenseCategory.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(code !== undefined && { code: code?.trim() || null }),
      ...(activity !== undefined && { activity }),
      ...(affectsPL !== undefined && { affectsPL }),
      ...(parentId !== undefined && { parentId: parentId || null }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
      _count: { select: { vouchers: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('treasury', 'delete')
  if ('response' in auth) return auth.response

  const cat = await prisma.expenseCategory.findUnique({
    where: { id: params.id },
    include: { _count: { select: { vouchers: true, children: true } } },
  })
  if (!cat) return NextResponse.json({ error: 'البند غير موجود' }, { status: 404 })

  if (cat._count.vouchers > 0) {
    return NextResponse.json({ error: `لا يمكن حذف بند مرتبط بـ ${cat._count.vouchers} سند صرف — قم بتعطيله بدلاً من ذلك` }, { status: 400 })
  }
  if (cat._count.children > 0) {
    return NextResponse.json({ error: 'لا يمكن حذف بند له بنود فرعية' }, { status: 400 })
  }

  await prisma.expenseCategory.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
