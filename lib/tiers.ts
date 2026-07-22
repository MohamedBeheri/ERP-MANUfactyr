import { prisma } from '@/lib/prisma'

// فئات العملاء الافتراضية — لكل فئة مصدر سعر + خصم + نسبة بونص
const DEFAULT_TIERS = [
  { name: 'كبار الموردين والموزعين', priceSource: 'WHOLESALE', discountPercent: 5, bonusPercent: 3, sortOrder: 1 },
  { name: 'كبار العملاء', priceSource: 'WHOLESALE', discountPercent: 2, bonusPercent: 2, sortOrder: 2 },
  { name: 'تاجر تجزئة', priceSource: 'WHOLESALE', discountPercent: 0, bonusPercent: 1.5, sortOrder: 3 },
  { name: 'متوسط', priceSource: 'RETAIL', discountPercent: 5, bonusPercent: 1, sortOrder: 4 },
  { name: 'قطاعي', priceSource: 'RETAIL', discountPercent: 0, bonusPercent: 0.5, sortOrder: 5 },
]

let ensured = false

export async function ensureTiers() {
  if (ensured) return
  const count = await prisma.customerTier.count()
  if (count === 0) {
    await prisma.customerTier.createMany({ data: DEFAULT_TIERS })
  }
  ensured = true
}

// حساب سعر منتج لعميل حسب فئته
export function tierPrice(
  sellPrice: number,
  wholesalePrice: number,
  tier?: { priceSource: string; discountPercent: number } | null
): number {
  if (!tier) return sellPrice
  const base = tier.priceSource === 'WHOLESALE' && wholesalePrice > 0 ? wholesalePrice : sellPrice
  return Math.max(0, base * (1 - Number(tier.discountPercent) / 100))
}

// سعر منتج لعميل: حسب الفئة لو موجودة، وإلا حسب نوع العميل (جملة/قطاعي)
export function customerUnitPrice(
  sellPrice: number,
  wholesalePrice: number,
  customer: { customerType?: string | null; tier?: { priceSource: string; discountPercent: number } | null } | null
): number {
  const tier = customer?.tier || null
  const source = tier?.priceSource ?? (customer?.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL')
  const base = source === 'WHOLESALE' && wholesalePrice > 0 ? wholesalePrice : sellPrice
  const discount = tier ? Number(tier.discountPercent) : 0
  return Math.max(0, +(base * (1 - discount / 100)).toFixed(2))
}
