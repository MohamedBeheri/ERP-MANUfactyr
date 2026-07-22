// نظام مكافآت الكمية: اشترِ كمية معينة من صنف ← خُد كمية هدية.
// القواعد تُعرّف من الإعدادات (RewardRule) وتُطبَّق تلقائيًا في نقطة البيع وتسليم العربيات.

export interface CartLine {
  productId: string
  quantity: number
}

export interface BonusLine {
  productId: string
  quantity: number
  rewardRuleId: string
  ruleName: string
}

/**
 * يحسب بنود الهدية المستحقّة على سلّة بيع حسب فئة العميل.
 * @param db  عميل prisma أو transaction client
 * @param tierId  فئة العميل (null = عميل بدون فئة)
 * @param lines  الأصناف المشتراة (مدفوعة)
 */
export async function computeBonuses(
  db: any,
  tierId: string | null,
  lines: CartLine[]
): Promise<BonusLine[]> {
  if (!lines.length) return []

  const qtyByProduct = new Map<string, number>()
  for (const l of lines) {
    if (!l.productId || !(l.quantity > 0)) continue
    qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) || 0) + l.quantity)
  }
  const productIds = Array.from(qtyByProduct.keys())
  if (productIds.length === 0) return []

  // القواعد النشطة اللي بتنطبق على أصناف السلّة وعلى فئة العميل (أو على كل الفئات)
  const rules = await db.rewardRule.findMany({
    where: {
      isActive: true,
      productId: { in: productIds },
      OR: [{ tierId: null }, ...(tierId ? [{ tierId }] : [])],
    },
  })

  const merged = new Map<string, BonusLine>()
  for (const rule of rules) {
    if (rule.buyQuantity <= 0 || rule.freeQuantity <= 0) continue
    const bought = qtyByProduct.get(rule.productId) || 0
    if (bought < rule.buyQuantity) continue
    const times = rule.repeat ? Math.floor(bought / rule.buyQuantity) : 1
    const free = times * rule.freeQuantity
    if (free <= 0) continue

    const key = `${rule.freeProductId}:${rule.id}`
    const existing = merged.get(key)
    if (existing) existing.quantity += free
    else
      merged.set(key, {
        productId: rule.freeProductId,
        quantity: free,
        rewardRuleId: rule.id,
        ruleName: rule.name,
      })
  }
  return Array.from(merged.values())
}
