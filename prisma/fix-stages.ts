import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// تصحيح المراحل المخزنية: العطارة والنكهات ومواد التغليف كانت غلط في مرحلة "بن أخضر خام".
// idempotent — ينفع يتشغّل أكتر من مرة بأمان.
async function ensureWarehouse(name: string) {
  const ex = await prisma.warehouse.findUnique({ where: { name } })
  if (ex) return ex.id
  const c = await prisma.warehouse.create({ data: { name } })
  return c.id
}

async function ensureStage(name: string, warehouseId: string, sortOrder: number) {
  const ex = await prisma.stockStage.findFirst({ where: { name } })
  if (ex) {
    if (!ex.warehouseId) await prisma.stockStage.update({ where: { id: ex.id }, data: { warehouseId } })
    return ex.id
  }
  const c = await prisma.stockStage.create({ data: { name, warehouseId, sortOrder, sellable: false, purchasable: true } })
  return c.id
}

async function main() {
  const whSpice = await ensureWarehouse('مخزن العطارة')
  const whPack = await ensureWarehouse('مخزن التغليف')

  const spiceStage = await ensureStage('عطارة وتوابل', whSpice, 5)
  const flavorStage = await ensureStage('نكهات وإضافات', whSpice, 6)
  const packStage = await ensureStage('مواد التغليف', whPack, 7)

  const map: Record<string, { stage: string; wh: string }> = {
    SPICE: { stage: spiceStage, wh: whSpice },
    FLAVOR: { stage: flavorStage, wh: whSpice },
    PACKAGING: { stage: packStage, wh: whPack },
  }

  for (const kind of Object.keys(map)) {
    const { stage, wh } = map[kind]
    const prods = await prisma.product.findMany({ where: { itemKind: kind } })
    for (const p of prods) {
      await prisma.product.update({ where: { id: p.id }, data: { stageId: stage } })
      // نقل الرصيد لمخزن المرحلة الصح (توحيد كل الأرصدة في مخزن واحد)
      const total = (await prisma.productStock.aggregate({ where: { productId: p.id }, _sum: { quantity: true } }))._sum.quantity || 0
      await prisma.productStock.deleteMany({ where: { productId: p.id } })
      if (total !== 0) await prisma.productStock.create({ data: { productId: p.id, warehouseId: wh, quantity: total } })
    }
    console.log(`${kind} → ${prods.length} صنف اتنقلوا للمرحلة الصح`)
  }

  console.log('تم التصحيح ✓')
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
