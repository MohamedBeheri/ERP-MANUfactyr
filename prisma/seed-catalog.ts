import { PrismaClient } from '@prisma/client'
import { ensureStockStages } from '../lib/stock-stages'

const prisma = new PrismaClient()

// كتالوج مصنع البدر الحقيقي المستخرج من شيت Operation
const GREEN = [
  { name: 'بن أخضر — اندونيسي', roastLoss: 16 },
  { name: 'بن أخضر — هندي روبيستا', roastLoss: 15 },
  { name: 'بن أخضر — حبشي', roastLoss: 15 },
  { name: 'بن أخضر — برازيلي', roastLoss: 15 },
  { name: 'بن أخضر — XL', roastLoss: 14 },
]
const SPICE = ['حبهان', 'ورق لورا', 'بلح جوزة الطيب', 'جنسنج', 'قرنفل', 'زنجبيل']
const FLAVOR = ['نسكافيه', 'بندق', 'كراميل', 'فانيليا', 'شوكولاته']
const PACKAGING = [
  { name: 'كيس شوت', tare: 1.6 },
  { name: 'كيس سادة 30جم', tare: 2.17 },
  { name: 'كيس 50جم', tare: 3.2 },
  { name: 'كيس 100جم', tare: 5.2 },
  { name: 'الباكت الأبيض', tare: 5.2 },
  { name: 'الباكت الورق', tare: 7.75 },
  { name: 'الباكت الورق الأسود', tare: 5.0 },
  { name: 'شرينك الشرايط', tare: 0 },
  { name: 'شرينك التفويقة', tare: 0 },
  { name: 'شرينك علب', tare: 0 },
  { name: 'الكرتونة', tare: 0 },
]
// التوليفات ووصفاتها (نسب البن الأخضر % + جرعة العطارة لكل كيلو)
const BLENDS: { name: string; greens: [string, number][]; spices?: [string, number][] }[] = [
  {
    name: 'توليفة سادة',
    greens: [['بن أخضر — اندونيسي', 65], ['بن أخضر — هندي روبيستا', 10], ['بن أخضر — برازيلي', 15], ['بن أخضر — XL', 10]],
  },
  {
    name: 'توليفة محوج',
    greens: [['بن أخضر — اندونيسي', 64.23], ['بن أخضر — هندي روبيستا', 9.88], ['بن أخضر — برازيلي', 14.82], ['بن أخضر — XL', 9.88], ['بن أخضر — حبشي', 1.19]],
    spices: [['حبهان', 12], ['ورق لورا', 8]],
  },
  {
    name: 'توليفة عربي',
    greens: [['بن أخضر — اندونيسي', 69.31], ['بن أخضر — هندي روبيستا', 14.85], ['بن أخضر — برازيلي', 14.85]],
  },
  {
    name: 'توليفة النكهات (بيز)',
    greens: [['بن أخضر — اندونيسي', 55.32], ['بن أخضر — هندي روبيستا', 8.51], ['بن أخضر — برازيلي', 12.77], ['بن أخضر — XL', 8.51]],
  },
]
// عينة منتجات نهائية بمواصفات التعبئة (توليفة + وزن القطعة + قطع/علبة + تغليف)
const FINISHED: { name: string; blend: string; grams: number; pcs: number; pkg: string }[] = [
  { name: 'شوت ١٠ جرام سادة', blend: 'توليفة سادة', grams: 10, pcs: 12, pkg: 'كيس شوت' },
  { name: 'شوت ١٠ جرام محوج', blend: 'توليفة محوج', grams: 10, pcs: 12, pkg: 'كيس شوت' },
  { name: 'سوسته ٢٥٠ جرام سادة', blend: 'توليفة سادة', grams: 250, pcs: 4, pkg: 'الباكت الأبيض' },
  { name: 'سوسته ٢٥٠ جرام محوج', blend: 'توليفة محوج', grams: 250, pcs: 4, pkg: 'الباكت الأبيض' },
  { name: 'علبة ١٠٠ جرام سادة', blend: 'توليفة سادة', grams: 100, pcs: 10, pkg: 'كيس 100جم' },
  { name: 'علبة ٥٠ جرام محوج', blend: 'توليفة محوج', grams: 50, pcs: 10, pkg: 'كيس 50جم' },
]

async function main() {
  await ensureStockStages()
  const stages = await prisma.stockStage.findMany()
  const stageBy = (kw: string, fallbackSellable = false) =>
    stages.find((s) => s.name.includes(kw))?.id ||
    (fallbackSellable ? stages.find((s) => s.sellable)?.id : stages.find((s) => s.purchasable)?.id) ||
    stages[0]?.id ||
    null

  const rawStage = stageBy('خام')
  const groundStage = stageBy('مطحون') || stageBy('محمّص')
  const finishedStage = stageBy('نهائي', true)

  const idByName = new Map<string, string>()
  async function upsert(name: string, kind: string, extra: any, stageId: string | null) {
    const existing = await prisma.product.findFirst({ where: { name } })
    const data = { name, type: 'RAW' as const, itemKind: kind, stageId, unit: extra.unit || 'كجم', costPrice: 0, sellPrice: 0, ...extra }
    const p = existing
      ? await prisma.product.update({ where: { id: existing.id }, data: { itemKind: kind, ...extra, stageId } })
      : await prisma.product.create({ data })
    idByName.set(name, p.id)
    return p.id
  }

  for (const g of GREEN) await upsert(g.name, 'GREEN', { roastLossPercent: g.roastLoss, unit: 'كجم' }, rawStage)
  for (const s of SPICE) await upsert(s, 'SPICE', { unit: 'كجم' }, rawStage)
  for (const f of FLAVOR) await upsert(f, 'FLAVOR', { unit: 'كجم' }, rawStage)
  for (const p of PACKAGING) await upsert(p.name, 'PACKAGING', { tareWeight: p.tare, unit: 'قطعة' }, rawStage)

  // التوليفات + مكوّناتها
  for (const b of BLENDS) {
    const blendId = await upsert(b.name, 'BLEND', { unit: 'كجم' }, groundStage)
    await prisma.blendComponent.deleteMany({ where: { blendId } })
    for (const [gname, pct] of b.greens) {
      const cid = idByName.get(gname)
      if (cid) await prisma.blendComponent.create({ data: { blendId, componentId: cid, percent: pct, perKilo: 0 } })
    }
    for (const [sname, perKilo] of b.spices || []) {
      const cid = idByName.get(sname)
      if (cid) await prisma.blendComponent.create({ data: { blendId, componentId: cid, percent: 0, perKilo } })
    }
  }

  // المنتجات النهائية بمواصفات التعبئة
  for (const f of FINISHED) {
    await upsert(f.name, 'FINISHED', {
      type: 'FINISHED',
      unit: 'علبة',
      blendId: idByName.get(f.blend) || null,
      packagingId: idByName.get(f.pkg) || null,
      gramsPerPiece: f.grams,
      piecesPerBox: f.pcs,
    }, finishedStage)
  }

  const counts = {
    green: GREEN.length, spice: SPICE.length, flavor: FLAVOR.length,
    packaging: PACKAGING.length, blends: BLENDS.length, finished: FINISHED.length,
  }
  console.log('✅ كتالوج المصنع:', counts)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
