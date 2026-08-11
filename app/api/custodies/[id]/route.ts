import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { applyTreasuryTxn } from '@/lib/treasuries'
import { parseNum } from '@/lib/numbers'

// PATCH: دورة حياة العهدة — approve/reject (أدمن) → disburse (خزنة) → settle (خزنة)
export async function PATCH(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const body = await req.json()
  const action = String(body.action || '')

  const custody = await prisma.custody.findUnique({
    where: { id: params.id },
    include: { user: { select: { name: true } }, expenses: true },
  })
  if (!custody) return NextResponse.json({ error: 'العهدة غير موجودة' }, { status: 404 })

  // ===== الاعتماد/الرفض: الأدمن فقط — فصل من بيصرف عن من بيوافق =====
  if (action === 'approve' || action === 'reject') {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'اعتماد العُهد من صلاحية مدير النظام فقط' }, { status: 403 })
    }
    if (custody.status !== 'PENDING') {
      return NextResponse.json({ error: 'الطلب ده اتبت فيه قبل كده' }, { status: 400 })
    }

    if (action === 'reject') {
      const reason = String(body.reason || '').trim()
      if (!reason) return NextResponse.json({ error: 'اكتب سبب الرفض' }, { status: 400 })
      await prisma.custody.update({
        where: { id: custody.id },
        data: { status: 'REJECTED', rejectReason: reason, approvedById: session.user.id, approvedAt: new Date() },
      })
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'رفض عهدة',
          description: `رفض طلب العهدة ${custody.custodyNo} (${custody.user.name}) — ${reason}`,
          impact: 'مفيش أثر مالي',
        },
      })
      return NextResponse.json({ success: true })
    }

    const approvedAmount = body.approvedAmount != null ? parseNum(body.approvedAmount) : Number(custody.requestedAmount)
    if (!(approvedAmount > 0)) return NextResponse.json({ error: 'مبلغ الاعتماد غير صحيح' }, { status: 400 })

    await prisma.custody.update({
      where: { id: custody.id },
      data: { status: 'APPROVED', approvedAmount, approvedById: session.user.id, approvedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'اعتماد عهدة',
        description: `اعتماد العهدة ${custody.custodyNo} (${custody.user.name})`,
        impact: `${approvedAmount.toLocaleString('ar-EG')} ج.م بانتظار الصرف من الخزنة`,
      },
    })
    return NextResponse.json({ success: true })
  }

  // ===== الصرف: صلاحية خزنة — الوسيلة بتحدد الخزنة اللي بيتخصم منها =====
  if (action === 'disburse') {
    const auth = await requirePermission('treasury', 'edit')
    if ('response' in auth) return auth.response
    const { session } = auth

    if (custody.status !== 'APPROVED') {
      return NextResponse.json({ error: 'مينفعش الصرف غير بعد اعتماد الإدارة' }, { status: 400 })
    }
    const paymentMethodId = String(body.paymentMethodId || '')
    const treasuryId = String(body.treasuryId || '')
    if (!paymentMethodId || !treasuryId) {
      return NextResponse.json({ error: 'اختار وسيلة الصرف والخزنة' }, { status: 400 })
    }
    const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } })
    if (!method || !method.isActive) return NextResponse.json({ error: 'وسيلة الدفع غير موجودة' }, { status: 400 })

    const amount = Number(custody.approvedAmount)

    try {
      await prisma.$transaction(async (tx) => {
        await applyTreasuryTxn(tx, {
          treasuryId,
          type: 'OUT',
          amount,
          refType: 'CUSTODY',
          reference: custody.custodyNo,
          description: `صرف عهدة ${custody.custodyNo} للموظف ${custody.user.name} (${method.name})`,
          createdById: session.user.id,
        })
        await tx.custody.update({
          where: { id: custody.id },
          data: {
            status: 'DISBURSED',
            paymentMethodId,
            treasuryId,
            disbursedById: session.user.id,
            disbursedAt: new Date(),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'صرف عهدة',
            description: `صرف العهدة ${custody.custodyNo} للموظف ${custody.user.name} بوسيلة ${method.name}`,
            impact: `-${amount.toLocaleString('ar-EG')} ج.م من الخزنة · نقدية في عهدة الموظف`,
          },
        })
      })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'فشل صرف العهدة' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  // ===== التسوية: صلاحية خزنة — المتبقي يرجع للخزنة بوسيلته =====
  if (action === 'settle') {
    const auth = await requirePermission('treasury', 'edit')
    if ('response' in auth) return auth.response
    const { session } = auth

    if (custody.status !== 'DISBURSED') {
      return NextResponse.json({ error: 'العهدة دي مش مصروفة أو اتسوّت قبل كده' }, { status: 400 })
    }
    const pending = custody.expenses.filter((e) => e.status === 'PENDING')
    if (pending.length > 0) {
      return NextResponse.json(
        { error: `فيه ${pending.length} مصروف لسه بانتظار الاعتماد — اعتمدهم أو ارفضهم الأول` },
        { status: 400 }
      )
    }

    const amount = Number(custody.approvedAmount)
    const approvedExpenses = custody.expenses
      .filter((e) => e.status === 'APPROVED')
      .reduce((s, e) => s + Number(e.amount), 0)
    const returned = +(amount - approvedExpenses).toFixed(2)
    if (returned < 0) {
      return NextResponse.json(
        { error: `المصروفات المعتمدة (${approvedExpenses}) أكبر من مبلغ العهدة (${amount}) — راجع المصروفات` },
        { status: 400 }
      )
    }

    const returnMethodId = returned > 0 ? String(body.returnMethodId || '') : null
    const returnTreasuryId = returned > 0 ? String(body.returnTreasuryId || '') : null
    if (returned > 0 && (!returnMethodId || !returnTreasuryId)) {
      return NextResponse.json(
        { error: `الموظف لازم يرجّع ${returned.toLocaleString('ar-EG')} ج.م — اختار وسيلة الاسترداد والخزنة اللي هترجعلها` },
        { status: 400 }
      )
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (returned > 0 && returnTreasuryId) {
          const method = returnMethodId ? await tx.paymentMethod.findUnique({ where: { id: returnMethodId } }) : null
          await applyTreasuryTxn(tx, {
            treasuryId: returnTreasuryId,
            type: 'IN',
            amount: returned,
            refType: 'CUSTODY_RETURN',
            reference: custody.custodyNo,
            description: `رد متبقي عهدة ${custody.custodyNo} من الموظف ${custody.user.name}${method ? ` (${method.name})` : ''}`,
            createdById: session.user.id,
          })
        }
        await tx.custody.update({
          where: { id: custody.id },
          data: {
            status: 'SETTLED',
            returnedAmount: returned,
            returnMethodId,
            returnTreasuryId,
            settledById: session.user.id,
            settledAt: new Date(),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'تسوية عهدة',
            description: `تسوية العهدة ${custody.custodyNo} (${custody.user.name})`,
            impact: `مصروفات معتمدة ${approvedExpenses.toLocaleString('ar-EG')} ج.م · مرتجع للخزنة ${returned.toLocaleString('ar-EG')} ج.م`,
          },
        })
      })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'فشل تسوية العهدة' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
}
