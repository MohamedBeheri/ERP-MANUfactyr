import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { ensureTreasuries, salesmanTreasury, applyTreasuryTxn, MAIN_CASH_NAME, CLEARING_NAME } from '@/lib/treasuries'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response

  const unsettled = req.nextUrl.searchParams.get('unsettled')
  const where: any = {}
  if (unsettled) {
    // الإلكتروني اللي لسه ما اتسوّاش للبنك (كشف حساب الوسيط المتبقي)
    where.isSettled = false
    where.paymentMethod = { type: 'ELECTRONIC' }
  }

  const collections = await prisma.collection.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      delegate: { select: { id: true, name: true } },
      paymentMethod: true,
      treasury: { select: { id: true, name: true, type: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(collections)
}

// سند تحصيل: التوجيه للخزنة حسب نوع وسيلة الدفع
// إلكتروني → حساب إنستا باي تحت التسوية (برقم مرجعي إجباري)
// نقدي + مندوب → خزنة المندوب النقدية — نقدي بدون مندوب → الخزنة العمومية
export async function POST(req: NextRequest) {
  const auth = await requirePermission('treasury', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const amount = Number(b.amount)
    if (!b.customerId || !b.paymentMethodId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'العميل ووسيلة الدفع والمبلغ مطلوبين' }, { status: 400 })
    }

    await ensureTreasuries()
    const method = await prisma.paymentMethod.findUnique({ where: { id: b.paymentMethodId } })
    if (!method) return NextResponse.json({ error: 'وسيلة الدفع غير موجودة' }, { status: 400 })

    const transactionReference = b.transactionReference?.trim() || null
    if (method.type === 'ELECTRONIC' && !transactionReference) {
      return NextResponse.json({ error: 'الرقم المرجعي للعملية إجباري للتحصيل الإلكتروني (إنستا باي)' }, { status: 400 })
    }

    const collection = await prisma.$transaction(async (tx) => {
      // تحديد الخزنة المستهدفة
      let treasuryId: string
      if (method.type === 'ELECTRONIC') {
        const clearing = await tx.treasury.findUnique({ where: { name: CLEARING_NAME } })
        treasuryId = clearing!.id
      } else if (b.delegateId) {
        treasuryId = await salesmanTreasury(tx, b.delegateId)
      } else {
        const main = await tx.treasury.findUnique({ where: { name: MAIN_CASH_NAME } })
        treasuryId = main!.id
      }

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const count = await tx.collection.count({ where: { collectionNo: { startsWith: `COL-${today}` } } })
      const collectionNo = `COL-${today}-${String(count + 1).padStart(3, '0')}`

      const customer = await tx.customer.findUnique({ where: { id: b.customerId } })
      if (!customer) throw new Error('العميل غير موجود')

      const created = await tx.collection.create({
        data: {
          collectionNo,
          customerId: b.customerId,
          delegateId: b.delegateId || null,
          amount,
          paymentMethodId: method.id,
          transactionReference,
          treasuryId,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
        },
        include: {
          customer: { select: { name: true } },
          paymentMethod: true,
          treasury: { select: { name: true, type: true } },
        },
      })

      // دخول المبلغ للخزنة المستهدفة + قيد دفتر أستاذ
      await applyTreasuryTxn(tx, {
        treasuryId,
        type: 'IN',
        amount,
        refType: 'collection',
        reference: transactionReference || collectionNo,
        description: `تحصيل من ${customer.name} — ${method.name}`,
        createdById: session.user.id,
      })

      // خصم التحصيل من مديونية العميل
      await tx.customer.update({
        where: { id: b.customerId },
        data: { balance: { decrement: amount } },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تحصيل',
          description: `سند تحصيل ${collectionNo} من ${customer.name} (${method.name})`,
          impact: `+${amount.toFixed(2)} ج.م → ${created.treasury.name}`,
        },
      })

      return created
    })

    return NextResponse.json(collection, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل إنشاء سند التحصيل' }, { status: 500 })
  }
}
