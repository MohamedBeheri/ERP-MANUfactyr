import { prisma } from '@/lib/prisma'
import { applyTreasuryTxn } from '@/lib/treasuries'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface VoucherLineInput {
  paymentMethodId: string
  treasuryId: string
  amount: number
  transactionReference?: string | null
  attachment?: string | null
}

// إنشاء سند صرف لسداد فاتورة شراء: بيوزّع مبلغ السداد على أكتر من وسيلة دفع دفعة واحدة،
// يفحص رصيد كل خزنة ويخصم منها فعليًا، ويحدّث حالة السداد على الفاتورة ومستحق المورد.
// المبلغ الكلي للسند = مجموع السطور دايمًا (مفيش إدخال منفصل للإجمالي) — كده شرط "المجموع = الإجمالي" محقق بالبناء.
export async function createPurchaseVoucher(
  tx: Tx,
  opts: {
    purchaseId: string
    lines: VoucherLineInput[]
    notes?: string | null
    createdById: string
  }
): Promise<{ voucher: { id: string; voucherNo: string; amount: number } }> {
  const db = tx as typeof prisma
  const { purchaseId, lines, notes, createdById } = opts

  if (!lines || lines.length === 0) {
    throw new Error('أضف سطر سداد واحد على الأقل')
  }
  for (const l of lines) {
    if (!l.paymentMethodId || !l.treasuryId || !(l.amount > 0)) {
      throw new Error('كل سطر سداد لازم يكون له وسيلة دفع وحساب ومبلغ أكبر من صفر')
    }
  }

  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) throw new Error('فاتورة الشراء غير موجودة')

  const total = lines.reduce((s, l) => s + l.amount, 0)
  const remaining = Number(purchase.totalAmount) - Number(purchase.paidAmount)
  if (total > remaining + 0.01) {
    throw new Error(`مبلغ السند (${total.toLocaleString('ar-EG')}) أكبر من المتبقي على الفاتورة (${remaining.toLocaleString('ar-EG')} ج.م)`)
  }

  // التحقق من وسائل الدفع والحسابات + إلزامية الرقم المرجعي للوسائل غير النقدية
  const methodIds = [...new Set(lines.map((l) => l.paymentMethodId))]
  const treasuryIds = [...new Set(lines.map((l) => l.treasuryId))]
  const [methods, treasuries] = await Promise.all([
    db.paymentMethod.findMany({ where: { id: { in: methodIds } } }),
    db.treasury.findMany({ where: { id: { in: treasuryIds } } }),
  ])
  const methodMap = new Map(methods.map((m) => [m.id, m]))
  const treasuryMap = new Map(treasuries.map((t) => [t.id, t]))

  for (const l of lines) {
    const method = methodMap.get(l.paymentMethodId)
    if (!method) throw new Error('وسيلة دفع غير موجودة')
    if (method.type !== 'CASH' && !l.transactionReference?.trim()) {
      throw new Error(`الرقم المرجعي إجباري لوسيلة "${method.name}"`)
    }
    const treasury = treasuryMap.get(l.treasuryId)
    if (!treasury) throw new Error('الحساب/الخزنة غير موجودة')
    if (!treasury.allowExpenseDisbursement) {
      throw new Error(`الصرف موقوف من "${treasury.name}" — فعّله من شاشة الخزائن الأول`)
    }
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = await db.purchaseVoucher.count({ where: { voucherNo: { startsWith: `PPV-${today}` } } })
  const voucherNo = `PPV-${today}-${String(count + 1).padStart(3, '0')}`

  const voucher = await db.purchaseVoucher.create({
    data: {
      voucherNo,
      purchaseId,
      supplierId: purchase.supplierId,
      amount: total,
      notes: notes?.trim() || null,
      createdById,
      lines: {
        create: lines.map((l) => ({
          paymentMethodId: l.paymentMethodId,
          treasuryId: l.treasuryId,
          amount: l.amount,
          transactionReference: l.transactionReference?.trim() || null,
          attachment: l.attachment || null,
        })),
      },
    },
  })

  // خصم فعلي من كل خزنة/حساب بفحص رصيد آمن
  for (const l of lines) {
    const method = methodMap.get(l.paymentMethodId)!
    await applyTreasuryTxn(db, {
      treasuryId: l.treasuryId,
      type: 'OUT',
      amount: l.amount,
      refType: 'purchase-voucher',
      reference: l.transactionReference || voucherNo,
      description: `سند صرف ${voucherNo} — سداد مورد (${method.name})`,
      createdById,
    })
  }

  const newPaid = Number(purchase.paidAmount) + total
  const newStatus = newPaid >= Number(purchase.totalAmount) - 0.01 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'
  const methodSummary = [...new Set(lines.map((l) => methodMap.get(l.paymentMethodId)!.name))].join(' + ')

  await db.purchase.update({
    where: { id: purchaseId },
    data: { paidAmount: newPaid, paymentStatus: newStatus, paymentMethod: methodSummary },
  })

  await db.supplier.update({
    where: { id: purchase.supplierId },
    data: { balance: { decrement: total } },
  })

  await db.auditLog.create({
    data: {
      userId: createdById,
      action: 'سند صرف مورد',
      description: `${voucherNo} — سداد فاتورة ${purchase.invoiceNo} (${methodSummary})`,
      impact: `-${total.toLocaleString('ar-EG')} ج.م`,
    },
  })

  return { voucher: { id: voucher.id, voucherNo: voucher.voucherNo, amount: total } }
}
