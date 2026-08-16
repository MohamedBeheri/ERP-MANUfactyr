import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureTreasuries, salesmanTreasury, applyTreasuryTxn, CLEARING_NAME, WALLET_CLEARING_NAME } from '@/lib/treasuries'
import { parseNum } from '@/lib/numbers'

// تحصيل مباشر من المندوب لعميله — بيدخل خزنة المندوب النقدية (أو حساب إلكتروني)
// ويُحتسب كـ"زيارة تحصيل" في تارجت المندوب، ويخصم من مديونية العميل
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })

  const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true } })
  if (!delegate) return NextResponse.json({ error: 'الحساب ده مش مربوط بمندوب' }, { status: 403 })

  try {
    const b = await req.json()
    const amount = parseNum(b.amount)
    if (!b.customerId || !b.paymentMethodId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'العميل ووسيلة الدفع والمبلغ مطلوبين' }, { status: 400 })
    }

    await ensureTreasuries()
    const method = await prisma.paymentMethod.findUnique({ where: { id: b.paymentMethodId } })
    if (!method) return NextResponse.json({ error: 'وسيلة الدفع غير موجودة' }, { status: 400 })

    // العميل لازم يكون من عملاء المندوب (ربط مباشر أو خط سير)
    const customer = await prisma.customer.findFirst({
      where: { id: b.customerId, OR: [{ delegateId: delegate.id }, { salesRoute: { delegateId: delegate.id } }] },
    })
    if (!customer) return NextResponse.json({ error: 'العميل ده مش من عملائك' }, { status: 403 })

    const transactionReference = b.transactionReference?.trim() || null
    if (method.type === 'ELECTRONIC' && !transactionReference) {
      return NextResponse.json({ error: 'الرقم المرجعي إجباري للتحصيل الإلكتروني' }, { status: 400 })
    }

    const collection = await prisma.$transaction(async (tx) => {
      let treasuryId: string
      if (method.type === 'ELECTRONIC') {
        const clearingName = method.name.includes('محفظة') ? WALLET_CLEARING_NAME : CLEARING_NAME
        const clearing = await tx.treasury.findUnique({ where: { name: clearingName } })
        treasuryId = clearing!.id
      } else {
        treasuryId = await salesmanTreasury(tx, delegate.id)
      }

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const count = await tx.collection.count({ where: { collectionNo: { startsWith: `COL-${today}` } } })
      const collectionNo = `COL-${today}-${String(count + 1).padStart(3, '0')}`

      const created = await tx.collection.create({
        data: {
          collectionNo, customerId: customer.id, delegateId: delegate.id, amount,
          paymentMethodId: method.id, transactionReference, treasuryId,
          notes: b.notes?.trim() || null, createdById: session.user.id,
        },
      })
      await applyTreasuryTxn(tx, {
        treasuryId, type: 'IN', amount, refType: 'collection', reference: transactionReference || collectionNo,
        description: `تحصيل من ${customer.name} — ${method.name} (مندوب ${delegate.name})`, createdById: session.user.id,
      })
      await tx.customer.update({ where: { id: customer.id }, data: { balance: { decrement: amount } } })
      await tx.auditLog.create({
        data: { userId: session.user.id, action: 'تحصيل مندوب', description: `سند ${collectionNo} من ${customer.name}`, impact: `+${amount.toFixed(2)} ج.م → خزنة المندوب` },
      })
      return created
    })

    return NextResponse.json({ success: true, collectionNo: collection.collectionNo }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تسجيل التحصيل' }, { status: 500 })
  }
}
