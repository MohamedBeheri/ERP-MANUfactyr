import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureStockStages } from '@/lib/stock-stages'
import { ROAST_DEGREES, stripGreenPrefix } from '@/lib/manufacturing'

// كتالوج مصنع البدر الحقيقي المستخرج من شيت Operation — نفس بيانات prisma/seed-catalog.ts
// مكشوف كـ API عشان نقدر نزرعه في قاعدة بيانات الإنتاج مباشرة (بروتوكول Postgres الخام مش متاح من بيئات تانية).
// محمي بـ SEED_SECRET ونفس المنطق آمن للتكرار (upsert بالاسم).
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
  { name: 'الكيس الشفاف', tare: 17.5 },
]
const BLENDS: { name: string; greens: [string, number][]; spices?: [string, number][] }[] = [
  { name: 'توليفة سادة', greens: [['بن أخضر — اندونيسي', 65], ['بن أخضر — هندي روبيستا', 10], ['بن أخضر — برازيلي', 15], ['بن أخضر — XL', 10]] },
  {
    name: 'توليفة محوج',
    greens: [['بن أخضر — اندونيسي', 63], ['بن أخضر — هندي روبيستا', 10], ['بن أخضر — برازيلي', 14], ['بن أخضر — XL', 10], ['بن أخضر — حبشي', 1]],
    spices: [['حبهان', 1.5], ['ورق لورا', 0.5]],
  },
  { name: 'توليفة عربي', greens: [['بن أخضر — اندونيسي', 70], ['بن أخضر — هندي روبيستا', 15], ['بن أخضر — برازيلي', 15]] },
  { name: 'توليفة النكهات (بيز)', greens: [['بن أخضر — اندونيسي', 65], ['بن أخضر — هندي روبيستا', 10], ['بن أخضر — برازيلي', 15], ['بن أخضر — XL', 10]] },
]
const FINISHED: { name: string; blend: string; grams: number; pcs: number; pkg: string; unit?: string; qty: number }[] = [
  { name: 'شوت ١٠ جرام سادة', blend: 'توليفة سادة', grams: 10, pcs: 12, pkg: 'كيس شوت', qty: 103 },
  { name: 'شوت ١٠ جرام محوج', blend: 'توليفة محوج', grams: 10, pcs: 12, pkg: 'كيس شوت', qty: 43 },
  { name: 'شوت ١٠ جرام فانيليا', blend: 'توليفة النكهات (بيز)', grams: 10, pcs: 12, pkg: 'كيس شوت', qty: 0 },
  { name: 'التفويقه سينجل سادة', blend: 'توليفة سادة', grams: 28, pcs: 12, pkg: 'كيس سادة 30جم', qty: 0 },
  { name: 'التفويقه سينجل محوج', blend: 'توليفة محوج', grams: 28, pcs: 12, pkg: 'كيس سادة 30جم', qty: 0 },
  { name: 'التفويقه دوبل سادة', blend: 'توليفة سادة', grams: 25, pcs: 28, pkg: 'كيس سادة 30جم', qty: 645 },
  { name: 'التفويقه دوبل محوج', blend: 'توليفة محوج', grams: 25, pcs: 28, pkg: 'كيس سادة 30جم', qty: 215 },
  { name: 'علبة ٥٠ جرام سادة', blend: 'توليفة سادة', grams: 50, pcs: 10, pkg: 'كيس 50جم', qty: 91 },
  { name: 'علبة ٥٠ جرام محوج', blend: 'توليفة محوج', grams: 50, pcs: 10, pkg: 'كيس 50جم', qty: 0 },
  { name: 'علبة ١٠٠ جرام سادة', blend: 'توليفة سادة', grams: 100, pcs: 10, pkg: 'كيس 100جم', qty: 60 },
  { name: 'علبة ١٠٠ جرام محوج', blend: 'توليفة محوج', grams: 100, pcs: 10, pkg: 'كيس 100جم', qty: 64 },
  { name: 'عرض ٢٢٥ جرام سادة', blend: 'توليفة سادة', grams: 225, pcs: 4, pkg: 'الباكت الأبيض', qty: 0 },
  { name: 'عرض ٢٢٥ جرام محوج', blend: 'توليفة محوج', grams: 225, pcs: 4, pkg: 'الباكت الأبيض', qty: 0 },
  { name: 'كامل ٢٥٠ جرام سادة (أبيض)', blend: 'توليفة سادة', grams: 250, pcs: 4, pkg: 'الباكت الأبيض', qty: 0 },
  { name: 'كامل ٢٥٠ جرام محوج (أبيض)', blend: 'توليفة محوج', grams: 250, pcs: 4, pkg: 'الباكت الأبيض', qty: 0 },
  { name: 'كامل ٢٥٠ جرام سادة (ورق)', blend: 'توليفة سادة', grams: 250, pcs: 4, pkg: 'الباكت الورق', qty: 0 },
  { name: 'كامل ٢٥٠ جرام محوج (ورق)', blend: 'توليفة محوج', grams: 250, pcs: 4, pkg: 'الباكت الورق', qty: 0 },
  { name: 'غامق ٢٥٠ جرام سادة', blend: 'توليفة سادة', grams: 250, pcs: 4, pkg: 'الباكت الورق الأسود', qty: 20.5 },
  { name: 'غامق ٢٥٠ جرام محوج', blend: 'توليفة محوج', grams: 250, pcs: 4, pkg: 'الباكت الورق الأسود', qty: 0 },
  { name: 'شرينك الشرايط سادة', blend: 'توليفة سادة', grams: 10, pcs: 12, pkg: 'شرينك الشرايط', unit: 'شرينك', qty: 10315 },
  { name: 'شرينك الشرايط محوج', blend: 'توليفة محوج', grams: 10, pcs: 12, pkg: 'شرينك الشرايط', unit: 'شرينك', qty: 9795 },
  { name: 'عرض كيلو سادة', blend: 'توليفة سادة', grams: 1000, pcs: 20, pkg: 'كيس 50جم', unit: 'شرينك', qty: 0 },
  { name: 'عرض كيلو محوج', blend: 'توليفة محوج', grams: 1000, pcs: 20, pkg: 'كيس 50جم', unit: 'شرينك', qty: 0 },
  { name: 'سوسته ٢٠٠ جرام سادة', blend: 'توليفة سادة', grams: 200, pcs: 5, pkg: 'الباكت الأبيض', qty: 20 },
  { name: 'سوسته ٢٠٠ جرام محوج', blend: 'توليفة محوج', grams: 200, pcs: 5, pkg: 'الباكت الأبيض', qty: 9.6 },
  { name: 'سوسته ٢٥٠ جرام سادة', blend: 'توليفة سادة', grams: 250, pcs: 4, pkg: 'الباكت الأبيض', qty: 200.25 },
  { name: 'سوسته ٢٥٠ جرام محوج', blend: 'توليفة محوج', grams: 250, pcs: 4, pkg: 'الباكت الأبيض', qty: 30 },
  { name: 'سوسته ٢٥٠ جرام بندق', blend: 'توليفة النكهات (بيز)', grams: 250, pcs: 4, pkg: 'الباكت الأبيض', qty: 89.75 },
  { name: 'سوسته ١٢٥ جرام سادة', blend: 'توليفة سادة', grams: 125, pcs: 8, pkg: 'الباكت الأبيض', qty: 20.375 },
  { name: 'سوسته ١٢٥ جرام محوج', blend: 'توليفة محوج', grams: 125, pcs: 8, pkg: 'الباكت الأبيض', qty: 20 },
  { name: 'سايب سادة (كيلو)', blend: 'توليفة سادة', grams: 1000, pcs: 1, pkg: 'الكيس الشفاف', unit: 'كجم', qty: 252 },
  { name: 'سايب محوج (كيلو)', blend: 'توليفة محوج', grams: 1000, pcs: 1, pkg: 'الكيس الشفاف', unit: 'كجم', qty: 60 },
  { name: 'سايب نسكافيه (كيلو)', blend: 'توليفة النكهات (بيز)', grams: 1000, pcs: 1, pkg: 'الكيس الشفاف', unit: 'كجم', qty: 0 },
  { name: 'سايب بندق (كيلو)', blend: 'توليفة النكهات (بيز)', grams: 1000, pcs: 1, pkg: 'الكيس الشفاف', unit: 'كجم', qty: 0 },
  { name: 'سايب عربي (كيلو)', blend: 'توليفة عربي', grams: 1000, pcs: 1, pkg: 'الكيس الشفاف', unit: 'كجم', qty: 0 },
  { name: 'سايب كراميل (كيلو)', blend: 'توليفة النكهات (بيز)', grams: 1000, pcs: 1, pkg: 'الكيس الشفاف', unit: 'كجم', qty: 0 },
]

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
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
    const spiceStage = stageBy('عطارة') || rawStage
    const flavorStage = stageBy('نكهات') || spiceStage
    const packStage = stageBy('تغليف') || rawStage

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

    // إعادة تسمية المحمصات القديمة اللي لسه شايلة بادئة "بن أخضر" (اتزرعت قبل التصحيح)
    const oldRoasted = await prisma.product.findMany({ where: { itemKind: 'ROASTED', name: { contains: 'بن أخضر' } } })
    for (const p of oldRoasted) {
      const newName = stripGreenPrefix(p.name)
      if (newName !== p.name) await prisma.product.update({ where: { id: p.id }, data: { name: newName } })
    }

    const roastedStage = stageBy('محمّص')
    for (const g of GREEN) {
      for (const degree of ROAST_DEGREES) {
        await upsert(`${stripGreenPrefix(g.name)} — محمص (${degree})`, 'ROASTED', { unit: 'كجم' }, roastedStage)
      }
    }
    for (const s of SPICE) await upsert(s, 'SPICE', { unit: 'كجم' }, spiceStage)
    for (const f of FLAVOR) await upsert(f, 'FLAVOR', { unit: 'كجم' }, flavorStage)
    for (const p of PACKAGING) await upsert(p.name, 'PACKAGING', { tareWeight: p.tare, unit: 'قطعة' }, packStage)

    for (const b of BLENDS) {
      const blendId = await upsert(b.name, 'BLEND', { unit: 'كجم' }, groundStage)
      await prisma.blendComponent.deleteMany({ where: { blendId } })
      for (const [gname, pct] of b.greens) {
        const cid = idByName.get(gname)
        if (cid) await prisma.blendComponent.create({ data: { blendId, componentId: cid, percent: pct, roastDegree: 'وسط', perKilo: 0 } })
      }
      for (const [sname, pct] of b.spices || []) {
        const cid = idByName.get(sname)
        if (cid) await prisma.blendComponent.create({ data: { blendId, componentId: cid, percent: pct, perKilo: 0 } })
      }
    }

    const finishedStageRec = stages.find((s) => s.id === finishedStage)
    const finishedWarehouseId = finishedStageRec?.warehouseId || null
    for (const f of FINISHED) {
      const pid = await upsert(f.name, 'FINISHED', {
        type: 'FINISHED',
        unit: f.unit || 'علبة',
        blendId: idByName.get(f.blend) || null,
        packagingId: idByName.get(f.pkg) || null,
        gramsPerPiece: f.grams,
        piecesPerBox: f.pcs,
        quantity: f.qty,
      }, finishedStage)
      if (finishedWarehouseId) {
        await prisma.productStock.upsert({
          where: { warehouseId_productId: { warehouseId: finishedWarehouseId, productId: pid } },
          create: { warehouseId: finishedWarehouseId, productId: pid, quantity: f.qty },
          update: { quantity: f.qty },
        })
      }
    }

    const counts = {
      green: GREEN.length, roasted: GREEN.length * ROAST_DEGREES.length, spice: SPICE.length, flavor: FLAVOR.length,
      packaging: PACKAGING.length, blends: BLENDS.length, finished: FINISHED.length,
    }
    return NextResponse.json({ success: true, counts })
  } catch (e: any) {
    console.error('seed-catalog error:', e)
    return NextResponse.json({ error: 'Failed to seed catalog' }, { status: 500 })
  }
}
