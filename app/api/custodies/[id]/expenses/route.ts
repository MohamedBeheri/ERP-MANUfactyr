import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { parseNum } from '@/lib/numbers'

// POST: تسجيل مصروف على العهدة بإثبات — صاحب العهدة نفسه أو صلاحية الخزنة
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const custody = await prisma.custody.findUnique({ where: { id: params.id }, include: { expenses: true } })
  if (!custody) return NextResponse.json({ error: 'العهدة غير موجودة' }, { status: 404 })

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canManage = canDoAction(perms, 'treasury', 'edit')
  if (custody.userId !== session.user.id && !canManage) {
    return NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 })
  }
  if (custody.status !== 'DISBURSED') {
    return NextResponse.json({ error: 'مينفعش تسجيل مصروفات غير على عهدة مصروفة ولسه ما اتسوّتش' }, { status: 400 })
  }

  try {
    const b = await req.json()
    const amount = parseNum(b.amount)
    const description = String(b.description || '').trim()
    const attachment = b.attachment || null
    if (!(amount > 0) || !description) {
      return NextResponse.json({ error: 'اكتب مبلغ المصروف ووصفه' }, { status: 400 })
    }
    if (!attachment) {
      return NextResponse.json({ error: 'صورة الفاتورة/الإيصال إجبارية كإثبات للمصروف' }, { status: 400 })
    }

    // مينفعش مجموع المصروفات (المعتمد + المعلق) يعدي مبلغ العهدة
    const used = custody.expenses
      .filter((e) => e.status !== 'REJECTED')
      .reduce((s, e) => s + Number(e.amount), 0)
    const limit = Number(custody.approvedAmount)
    if (used + amount > limit) {
      return NextResponse.json(
        { error: `المصروف يتعدى المتبقي في العهدة (المتبقي: ${(limit - used).toLocaleString('ar-EG')} ج.م)` },
        { status: 400 }
      )
    }

    const expense = await prisma.custodyExpense.create({
      data: {
        custodyId: custody.id,
        amount,
        categoryId: b.categoryId || null,
        description,
        attachment,
        createdById: session.user.id,
      },
    })
    return NextResponse.json(expense, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تسجيل المصروف' }, { status: 500 })
  }
}

// PATCH: اعتماد/رفض مصروف — صلاحية الخزنة
export async function PATCH(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const { expenseId, action } = await req.json()
    if (!expenseId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
    }
    const expense = await prisma.custodyExpense.findUnique({ where: { id: String(expenseId) } })
    if (!expense || expense.custodyId !== params.id) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }
    if (expense.status !== 'PENDING') {
      return NextResponse.json({ error: 'المصروف ده اتبت فيه قبل كده' }, { status: 400 })
    }
    await prisma.custodyExpense.update({
      where: { id: expense.id },
      data: { status: action === 'approve' ? 'APPROVED' : 'REJECTED', approvedById: session.user.id },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل تحديث المصروف' }, { status: 500 })
  }
}
