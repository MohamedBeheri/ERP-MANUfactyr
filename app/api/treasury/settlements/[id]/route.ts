import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { ensureTreasuries, applyTreasuryTxn, warehouseTreasury, MAIN_CASH_NAME, CLEARING_NAME, WALLET_CLEARING_NAME } from '@/lib/treasuries'


export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  const settlement = await prisma.treasurySettlement.findUnique({
    where: { id: params.id },
    include: {
      delegate: true,
      createdBy: { select: { id: true, name: true, role: true } },
      acceptedBy: { select: { id: true, name: true } },
    },
  })
  if (!settlement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(settlement)
}

// قبول أو رفض التسوية — أمين الخزنة أو المحاسب أو الأدمن
export async function PATCH(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;
  const { session } = auth

  const body = await req.json()
  const { action, rejectionReason } = body // action: "accept" | "reject"

  const settlement = await prisma.treasurySettlement.findUnique({ where: { id: params.id } })
  if (!settlement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (settlement.status !== 'PENDING') {
    return NextResponse.json({ error: 'التسوية تم التعامل معها بالفعل' }, { status: 400 })
  }

  if (action === 'accept') {
    await ensureTreasuries()
    // تفصيل المبلغ على الوسائل — تسويات قديمة بدون تفصيل بتتعامل كلها كاش
    let cashPart = Number(settlement.cashOnlyAmount)
    const instaPart = Number(settlement.instapayAmount)
    const walletPart = Number(settlement.walletAmount)
    if (cashPart + instaPart + walletPart === 0) cashPart = Number(settlement.amount)

    const [mainCash, clearing, walletClearing] = await Promise.all([
      prisma.treasury.findUnique({ where: { name: MAIN_CASH_NAME } }),
      prisma.treasury.findUnique({ where: { name: CLEARING_NAME } }),
      prisma.treasury.findUnique({ where: { name: WALLET_CLEARING_NAME } }),
    ])

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.treasurySettlement.update({
        where: { id: params.id },
        data: {
          status: 'ACCEPTED',
          acceptedById: (session.user as any).id,
          acceptedAt: new Date(),
        },
      })
      await tx.cashFlow.create({
        data: {
          description: `تسوية خزنة ${settlement.settlementNo}`,
          type: 'IN',
          amount: settlement.amount,
          balance: 0,
          reference: settlement.settlementNo,
          activity: 'OPERATING',
        },
      })
      // الكاش الفعلي يدخل الخزنة العمومية — الإلكتروني (إنستا/محفظة) يدخل الحساب الوسيط لحد ما يتطابق مع البنك
      if (cashPart > 0 && mainCash) {
        await applyTreasuryTxn(tx, {
          treasuryId: mainCash.id,
          type: 'IN',
          amount: cashPart,
          refType: 'settlement',
          reference: settlement.settlementNo,
          description: `تسوية ${settlement.settlementNo} — كاش محصّل`,
          createdById: (session.user as any).id,
        })
      }
      if (instaPart > 0 && clearing) {
        await applyTreasuryTxn(tx, {
          treasuryId: clearing.id,
          type: 'IN',
          amount: instaPart,
          refType: 'settlement',
          reference: settlement.settlementNo,
          description: `تسوية ${settlement.settlementNo} — تحويلات إنستا باي`,
          createdById: (session.user as any).id,
        })
      }
      if (walletPart > 0 && (walletClearing || clearing)) {
        // تحويلات المحفظة بتدخل حساب المحفظة الوسيط — نفس الطريقة اللي المندوب حوّل بيها
        await applyTreasuryTxn(tx, {
          treasuryId: (walletClearing || clearing)!.id,
          type: 'IN',
          amount: walletPart,
          refType: 'settlement',
          reference: settlement.settlementNo,
          description: `تسوية ${settlement.settlementNo} — تحويلات محفظة`,
          createdById: (session.user as any).id,
        })
      }
      // لو التسوية من خزنة مخزن — نخصم المبلغ من خزنة المخزن (الكاش خرج منها للعمومية)
      if (settlement.warehouseId) {
        const whTrId = await warehouseTreasury(tx, settlement.warehouseId)
        await applyTreasuryTxn(tx, {
          treasuryId: whTrId,
          type: 'OUT',
          amount: Number(settlement.amount),
          refType: 'settlement',
          reference: settlement.settlementNo,
          description: `تسوية ${settlement.settlementNo} — تسليم كاش للعمومية`,
          createdById: (session.user as any).id,
        })
      }
      return u
    })
    return NextResponse.json(updated)
  }

  if (action === 'reject') {
    if (!rejectionReason) {
      return NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 })
    }
    const updated = await prisma.treasurySettlement.update({
      where: { id: params.id },
      data: { status: 'REJECTED', rejectionReason, acceptedById: (session.user as any).id },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
}
