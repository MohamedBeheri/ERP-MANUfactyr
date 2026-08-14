import { prisma } from '@/lib/prisma'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseTreasury, applyTreasuryTxn, CLEARING_NAME, BANK_NAME } from '@/lib/treasuries'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const RECIPE_REASON = 'استهلاك توليفة كافيه'

// عكس كل آثار الفاتورة (مخزون + خزائن + أرصدة العميل) — بيُستخدم في الحذف والتعديل
export async function reverseInvoiceEffects(tx: Tx, invoiceId: string) {
  const db = tx as typeof prisma
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { items: true } })
  if (!inv) throw new Error('الفاتورة غير موجودة')

  // 1) استرجاع المخزون من أذون الصرف المرتبطة بالفاتورة
  const outs = await db.warehouseOut.findMany({ where: { target: { contains: inv.invoiceNo } } })
  for (const o of outs) {
    if (o.warehouseId) await adjustStock(tx, o.warehouseId, o.productId, Number(o.quantity))
    // أصناف المنتجات بتخصم من product.quantity كمان · خامات التوليفة لأ
    if (o.reason !== RECIPE_REASON) {
      await db.product.update({ where: { id: o.productId }, data: { quantity: { increment: Number(o.quantity) } } })
    }
  }
  await db.warehouseOut.deleteMany({ where: { target: { contains: inv.invoiceNo } } })

  // 2) عكس حركات الخزائن (بيع الكافيه)
  const txns = await db.treasuryTransaction.findMany({ where: { reference: inv.invoiceNo, refType: 'cafe-sale' } })
  const byTreasury: Record<string, number> = {}
  for (const t of txns) {
    const d = t.type === 'IN' ? Number(t.amount) : -Number(t.amount)
    byTreasury[t.treasuryId] = (byTreasury[t.treasuryId] || 0) + d
  }
  for (const [tid, sum] of Object.entries(byTreasury)) {
    await db.treasury.update({ where: { id: tid }, data: { balance: { decrement: sum } } })
  }
  await db.treasuryTransaction.deleteMany({ where: { reference: inv.invoiceNo, refType: 'cafe-sale' } })

  // 3) عكس أرصدة العميل
  const buyer = await db.customer.findUnique({ where: { id: inv.customerId }, include: { tier: true } })
  const earned = buyer?.tier ? (Number(inv.netAmount) * Number(buyer.tier.bonusPercent)) / 100 : 0
  await db.customer.update({
    where: { id: inv.customerId },
    data: {
      totalPurchases: { decrement: Number(inv.netAmount) },
      ...(inv.type === 'CREDIT' ? { balance: { decrement: Number(inv.netAmount) } } : {}),
      ...(earned > 0 ? { bonusPoints: { decrement: earned } } : {}),
    },
  })

  return inv
}

// تطبيق آثار بنود فاتورة (بعد التعديل) — خصم مخزون + خزنة + أرصدة العميل. من غير هدايا تلقائية.
export async function applyInvoiceItems(
  tx: Tx,
  invoice: { id: string; invoiceNo: string; customerId: string; netAmount: number; type: string },
  opts: { items: { productId: string; quantity: number }[]; warehouseId: string; cafeSale: boolean; paymentMethod: string; createdById: string }
) {
  const db = tx as typeof prisma
  const { items, warehouseId, cafeSale, paymentMethod, createdById } = opts

  const recipes = await db.cafeRecipeItem.findMany({ where: { productId: { in: items.map((i) => i.productId) } } })
  const recipeByProduct = new Map<string, typeof recipes>()
  for (const r of recipes) {
    const list = recipeByProduct.get(r.productId) || []
    list.push(r)
    recipeByProduct.set(r.productId, list)
  }

  // خصم المخزون + إذن صرف
  for (const it of items) {
    const recipe = recipeByProduct.get(it.productId)
    if (recipe && recipe.length > 0) {
      for (const r of recipe) {
        const needed = Number(r.quantity) * it.quantity
        const matStock = await getStock(warehouseId, r.materialId)
        if (matStock < needed) throw new Error('رصيد خامات التوليفة غير كافي بعد التعديل')
        await adjustStock(tx, warehouseId, r.materialId, -needed)
        await db.warehouseOut.create({
          data: { productId: r.materialId, warehouseId, quantity: needed, target: `استهلاك توليفة - فاتورة ${invoice.invoiceNo}`, reason: RECIPE_REASON, createdById },
        })
      }
      continue
    }
    const stock = await getStock(warehouseId, it.productId)
    if (stock < it.quantity) throw new Error('رصيد الصنف غير كافي بعد التعديل')
    await db.product.update({ where: { id: it.productId }, data: { quantity: { decrement: it.quantity } } })
    await adjustStock(tx, warehouseId, it.productId, -it.quantity)
    await db.warehouseOut.create({
      data: { productId: it.productId, warehouseId, quantity: it.quantity, target: `عميل - فاتورة ${invoice.invoiceNo}`, reason: 'فاتورة بيع (تعديل)', createdById },
    })
  }

  // أرصدة العميل
  const buyer = await db.customer.findUnique({ where: { id: invoice.customerId }, include: { tier: true } })
  const earned = buyer?.tier ? (Number(invoice.netAmount) * Number(buyer.tier.bonusPercent)) / 100 : 0
  await db.customer.update({
    where: { id: invoice.customerId },
    data: {
      totalPurchases: { increment: Number(invoice.netAmount) },
      ...(invoice.type === 'CREDIT' ? { balance: { increment: Number(invoice.netAmount) } } : {}),
      ...(earned > 0 ? { bonusPoints: { increment: earned } } : {}),
    },
  })

  // الخزائن (للكافيه فقط · غير الآجل)
  if (cafeSale && invoice.type !== 'CREDIT' && Number(invoice.netAmount) > 0) {
    const m = (paymentMethod || 'نقدي').trim()
    if (m === 'انستاباي') {
      const t = await db.treasury.findFirst({ where: { name: CLEARING_NAME } })
      if (t) await applyTreasuryTxn(tx, { treasuryId: t.id, type: 'IN', amount: Number(invoice.netAmount), refType: 'cafe-sale', reference: invoice.invoiceNo, description: `تعديل فاتورة كافيه انستاباي ${invoice.invoiceNo}`, createdById })
    } else if (m === 'فيزا') {
      const t = await db.treasury.findFirst({ where: { name: BANK_NAME } })
      if (t) await applyTreasuryTxn(tx, { treasuryId: t.id, type: 'IN', amount: Number(invoice.netAmount), refType: 'cafe-sale', reference: invoice.invoiceNo, description: `تعديل فاتورة كافيه فيزا ${invoice.invoiceNo}`, createdById })
    } else {
      const trId = await warehouseTreasury(tx, warehouseId)
      await applyTreasuryTxn(tx, { treasuryId: trId, type: 'IN', amount: Number(invoice.netAmount), refType: 'cafe-sale', reference: invoice.invoiceNo, description: `تعديل فاتورة كافيه نقدي ${invoice.invoiceNo}`, createdById })
    }
  }
}
