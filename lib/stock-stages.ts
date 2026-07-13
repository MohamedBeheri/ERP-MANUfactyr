import { prisma } from '@/lib/prisma'

// المراحل المخزنية الافتراضية — تتزرع أول مرة وتترحّل عليها البيانات القديمة
const DEFAULT_STAGES = [
  { name: 'بن أخضر (خام)', sortOrder: 1, sellable: false, purchasable: true },
  { name: 'بن محمّص', sortOrder: 2, sellable: false, purchasable: false },
  { name: 'بن مطحون', sortOrder: 3, sellable: true, purchasable: false },
  { name: 'منتج نهائي معبّأ', sortOrder: 4, sellable: true, purchasable: false },
]

let ensured = false

// يضمن وجود المراحل والعمليات الافتراضية وترحيل الأصناف القديمة (type → stage)
export async function ensureStockStages() {
  if (ensured) return
  const count = await prisma.stockStage.count()
  if (count > 0) {
    ensured = true
    return
  }

  await prisma.$transaction(async (tx) => {
    // إنشاء المراحل
    const stageMap = new Map<string, string>()
    for (const s of DEFAULT_STAGES) {
      const created = await tx.stockStage.create({ data: s })
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

    // ترحيل الأصناف: الخام → بن أخضر ، النهائي → منتج نهائي معبّأ
    await tx.product.updateMany({ where: { type: 'RAW', stageId: null }, data: { stageId: green } })
    await tx.product.updateMany({ where: { type: 'FINISHED', stageId: null }, data: { stageId: finished } })
  })

  ensured = true
}
