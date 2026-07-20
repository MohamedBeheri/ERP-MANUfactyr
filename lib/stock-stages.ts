import { prisma } from '@/lib/prisma'

// المراحل المخزنية الافتراضية + المخزن المرتبط بكل مرحلة
const DEFAULT_STAGES = [
  { name: 'بن أخضر (خام)', warehouse: 'مخزن الخام', sortOrder: 1, sellable: false, purchasable: true },
  { name: 'بن محمّص', warehouse: 'مخزن التحميص', sortOrder: 2, sellable: false, purchasable: false },
  { name: 'بن مطحون', warehouse: 'مخزن المنتجات', sortOrder: 3, sellable: true, purchasable: false },
  { name: 'منتج نهائي معبّأ', warehouse: 'مخزن المنتجات', sortOrder: 4, sellable: true, purchasable: false },
]

let ensured = false

// يضمن وجود المراحل والمخازن والعمليات الافتراضية وترحيل البيانات القديمة
export async function ensureStockStages() {
  if (ensured) return
  const count = await prisma.stockStage.count()
  if (count > 0) {
    ensured = true
    return
  }

  await prisma.$transaction(async (tx) => {
    // إنشاء المخازن الثلاثة (لو مش موجودة)
    const warehouseNames = ['مخزن الخام', 'مخزن التحميص', 'مخزن المنتجات']
    const whMap = new Map<string, string>()
    for (let i = 0; i < warehouseNames.length; i++) {
      const name = warehouseNames[i]
      const existing = await tx.warehouse.findUnique({ where: { name } })
      if (existing) {
        whMap.set(name, existing.id)
      } else {
        const created = await tx.warehouse.create({ data: { name, isDefault: i === 0 } })
        whMap.set(name, created.id)
      }
    }

    // إنشاء المراحل وربطها بمخازنها
    const stageMap = new Map<string, string>()
    for (const s of DEFAULT_STAGES) {
      const created = await tx.stockStage.create({
        data: {
          name: s.name,
          sortOrder: s.sortOrder,
          sellable: s.sellable,
          purchasable: s.purchasable,
          warehouseId: whMap.get(s.warehouse) || null,
        },
      })
      stageMap.set(s.name, created.id)
    }

    const green = stageMap.get('بن أخضر (خام)')!
    const roasted = stageMap.get('بن محمّص')!
    const ground = stageMap.get('بن مطحون')!
    const finished = stageMap.get('منتج نهائي معبّأ')!

    // العمليات الافتراضية
    await tx.productionOperation.createMany({
      data: [
        { name: 'تحميص', inputStageId: green, outputStageId: roasted, hasYieldLoss: true, sortOrder: 1 },
        { name: 'طحن', inputStageId: roasted, outputStageId: ground, hasYieldLoss: false, sortOrder: 2 },
        { name: 'تعبئة وتغليف', inputStageId: ground, outputStageId: finished, hasYieldLoss: false, sortOrder: 3 },
        { name: 'خلط وطحن وتعبئة', inputStageId: roasted, outputStageId: finished, hasYieldLoss: false, sortOrder: 4 },
      ],
    })

    // ترحيل الأصناف القديمة (type → stage)
    await tx.product.updateMany({ where: { type: 'RAW', stageId: null }, data: { stageId: green } })
    await tx.product.updateMany({ where: { type: 'FINISHED', stageId: null }, data: { stageId: finished } })

    // توحيد أرصدة كل صنف في مخزن مرحلته: لكل صنف رصيد واحد في مخزن واحد = quantity الإجمالي
    const products = await tx.product.findMany({ select: { id: true, quantity: true, stageId: true } })
    for (const p of products) {
      const stage = p.stageId ? DEFAULT_STAGES.find((s) => stageMap.get(s.name) === p.stageId) : null
      const whId = stage ? whMap.get(stage.warehouse) : whMap.get('مخزن الخام')
      if (!whId) continue
      // امسح أي أرصدة قديمة للصنف ده في مخازن تانية وحط رصيد واحد في مخزن مرحلته
      await tx.productStock.deleteMany({ where: { productId: p.id } })
      if (p.quantity !== 0) {
        await tx.productStock.create({ data: { productId: p.id, warehouseId: whId, quantity: p.quantity } })
      }
    }

    // إلغاء تفعيل "المخزن الرئيسي" القديم لو موجود وفاضي
    const legacy = await tx.warehouse.findFirst({ where: { name: 'المخزن الرئيسي' } })
    if (legacy) {
      const stockLeft = await tx.productStock.aggregate({ where: { warehouseId: legacy.id }, _sum: { quantity: true } })
      if ((stockLeft._sum.quantity || 0) === 0) {
        await tx.warehouse.update({ where: { id: legacy.id }, data: { isActive: false, isDefault: false } })
      }
    }
  })

  ensured = true
}

// المخزن المرتبط بمرحلة معيّنة (fallback للمخزن الافتراضي)
export async function warehouseForStage(stageId: string | null | undefined): Promise<string> {
  if (stageId) {
    const stage = await prisma.stockStage.findUnique({ where: { id: stageId } })
    if (stage?.warehouseId) return stage.warehouseId
  }
  const def = await prisma.warehouse.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  return def!.id
}
