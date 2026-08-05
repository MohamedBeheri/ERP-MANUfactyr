import { prisma } from '@/lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma

// أسماء الخزائن الافتراضية — ثابتة عشان الـ lookup
export const MAIN_CASH_NAME = 'الخزنة العمومية'
export const CLEARING_NAME = 'حساب إنستا باي تحت التسوية'
export const WALLET_CLEARING_NAME = 'حساب المحفظة تحت التسوية'
export const BANK_NAME = 'الحساب البنكي الرئيسي'

let ensured = false

// يضمن وجود الخزائن الأساسية + وسائل الدفع الافتراضية
export async function ensureTreasuries() {
  if (ensured) return
  const count = await prisma.treasury.count({ where: { type: { in: ['MAIN_CASH', 'CLEARING_ACCOUNT', 'BANK'] } } })
  if (count >= 4) {
    ensured = true
    return
  }

  await prisma.$transaction(async (tx) => {
    const defaults: { name: string; type: 'MAIN_CASH' | 'CLEARING_ACCOUNT' | 'BANK'; allowExpenseDisbursement: boolean }[] = [
      { name: MAIN_CASH_NAME, type: 'MAIN_CASH', allowExpenseDisbursement: true },
      { name: CLEARING_NAME, type: 'CLEARING_ACCOUNT', allowExpenseDisbursement: false },
      { name: WALLET_CLEARING_NAME, type: 'CLEARING_ACCOUNT', allowExpenseDisbursement: false },
      { name: BANK_NAME, type: 'BANK', allowExpenseDisbursement: false },
    ]
    for (const t of defaults) {
      const existing = await tx.treasury.findUnique({ where: { name: t.name } })
      if (!existing) await tx.treasury.create({ data: t })
    }

    const methods: { name: string; type: 'CASH' | 'ELECTRONIC' | 'BANK' }[] = [
      { name: 'نقدي', type: 'CASH' },
      { name: 'إنستا باي', type: 'ELECTRONIC' },
      { name: 'محفظة', type: 'ELECTRONIC' },
      { name: 'شبكة', type: 'BANK' },
    ]
    for (const m of methods) {
      const existing = await tx.paymentMethod.findUnique({ where: { name: m.name } })
      if (!existing) await tx.paymentMethod.create({ data: m })
    }
  })

  ensured = true
}

// خزنة مندوب نقدية — تتعمل تلقائي أول ما يتسجّل له تحصيل كاش
export async function salesmanTreasury(tx: Tx, delegateId: string): Promise<string> {
  const db = tx as typeof prisma
  const existing = await db.treasury.findUnique({ where: { delegateId } })
  if (existing) return existing.id
  const delegate = await db.delegate.findUnique({ where: { id: delegateId } })
  const created = await db.treasury.create({
    data: {
      name: `خزنة المندوب — ${delegate?.name || delegateId}`,
      type: 'SALESMAN_CASH',
      delegateId,
    },
  })
  return created.id
}

// تنفيذ حركة على خزنة: تعديل الرصيد + قيد في دفتر الأستاذ (كشف الحساب)
// ترجع الرصيد الجديد — وترمي خطأ لو OUT والرصيد مش كافي
export async function applyTreasuryTxn(
  tx: Tx,
  opts: {
    treasuryId: string
    type: 'IN' | 'OUT'
    amount: number
    refType: string
    reference?: string | null
    description: string
    createdById: string
  }
): Promise<number> {
  const db = tx as typeof prisma
  const treasury = await db.treasury.findUnique({ where: { id: opts.treasuryId } })
  if (!treasury) throw new Error('الخزنة غير موجودة')

  const current = Number(treasury.balance)
  const delta = opts.type === 'IN' ? opts.amount : -opts.amount
  const newBalance = current + delta
  if (opts.type === 'OUT' && newBalance < 0) {
    throw new Error(`رصيد ${treasury.name} غير كافي (المتاح: ${current.toLocaleString('ar-EG')} ج.م)`)
  }

  await db.treasury.update({ where: { id: opts.treasuryId }, data: { balance: newBalance } })
  await db.treasuryTransaction.create({
    data: {
      treasuryId: opts.treasuryId,
      type: opts.type,
      amount: opts.amount,
      balance: newBalance,
      refType: opts.refType,
      reference: opts.reference || null,
      description: opts.description,
      createdById: opts.createdById,
    },
  })
  return newBalance
}
