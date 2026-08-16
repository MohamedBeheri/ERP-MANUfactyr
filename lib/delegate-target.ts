import { prisma } from '@/lib/prisma'

// حدود شهر (year, month=1..12) بالتوقيت المحلي
export function monthRange(year: number, month: number) {
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const to = new Date(year, month, 0, 23, 59, 59, 999) // آخر يوم في الشهر
  return { from, to }
}

export interface DelegateAchievement {
  collectedAmount: number // المحصّل من عمليات البيع (كاش فوري + تحصيل آجل)
  salesVisits: number // زيارات بيع = فواتير محققة
  collectionVisits: number // زيارات تحصيل = عمليات تحصيل مبالغ
  productsSold: Record<string, number> // productId -> كمية مباعة
}

// إنجاز المندوب في شهر — محسوب تلقائيًا من فواتير وتحصيلات النظام
export async function computeDelegateAchievement(delegateId: string, year: number, month: number): Promise<DelegateAchievement> {
  const { from, to } = monthRange(year, month)

  const [invoices, collections, soldItems] = await Promise.all([
    // فواتير المندوب في الشهر (زيارات البيع + الكاش الفوري)
    prisma.invoice.findMany({
      where: { delegateId, createdAt: { gte: from, lte: to }, status: 'COMPLETED' },
      select: { id: true, type: true, netAmount: true },
    }),
    // تحصيلات المندوب من العملاء في الشهر (زيارات التحصيل + المبالغ)
    prisma.collection.findMany({
      where: { delegateId, createdAt: { gte: from, lte: to } },
      select: { amount: true },
    }),
    // كميات الأصناف المباعة عبر فواتير المندوب
    prisma.invoiceItem.groupBy({
      by: ['productId'],
      where: { invoice: { delegateId, createdAt: { gte: from, lte: to }, status: 'COMPLETED' }, isBonus: false },
      _sum: { quantity: true },
    }),
  ])

  const cashSales = invoices.filter((i) => i.type === 'CASH').reduce((s, i) => s + Number(i.netAmount), 0)
  const collected = collections.reduce((s, c) => s + Number(c.amount), 0)

  const productsSold: Record<string, number> = {}
  for (const row of soldItems) productsSold[row.productId] = Number(row._sum.quantity || 0)

  return {
    collectedAmount: +(cashSales + collected).toFixed(2),
    salesVisits: invoices.length,
    collectionVisits: collections.length,
    productsSold,
  }
}
