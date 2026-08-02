import { prisma } from '@/lib/prisma'

let ensured = false

// يضمن وجود مخزن الكافيه ومراحله (خامات قابلة للشراء + منتجات قابلة للبيع) وفئاته
export async function ensureCafeSetup() {
  if (ensured) return
  const existing = await prisma.stockStage.findFirst({ where: { name: 'منتجات الكافيه' } })
  if (existing) {
    ensured = true
    return
  }

  await prisma.$transaction(async (tx) => {
    const warehouse =
      (await tx.warehouse.findUnique({ where: { name: 'مخزن الكافيه' } })) ||
      (await tx.warehouse.create({ data: { name: 'مخزن الكافيه' } }))

    await tx.stockStage.create({
      data: { name: 'خامات الكافيه', sortOrder: 100, sellable: false, purchasable: true, warehouseId: warehouse.id },
    })
    await tx.stockStage.create({
      data: { name: 'منتجات الكافيه', sortOrder: 101, sellable: true, purchasable: false, warehouseId: warehouse.id },
    })

    for (const name of ['مشروبات الكافيه', 'ديزرت وحلويات']) {
      const cat = await tx.category.findUnique({ where: { name } })
      if (!cat) await tx.category.create({ data: { name } })
    }
  })

  ensured = true
}

// معرّفات مخزن ومراحل الكافيه (بعد التأكد من وجودها)
export async function getCafeStageIds() {
  await ensureCafeSetup()
  const [materials, items] = await Promise.all([
    prisma.stockStage.findFirst({ where: { name: 'خامات الكافيه' } }),
    prisma.stockStage.findFirst({ where: { name: 'منتجات الكافيه' } }),
  ])
  return { materialsStageId: materials!.id, itemsStageId: items!.id, warehouseId: materials!.warehouseId! }
}
