import { prisma } from '@/lib/prisma'

// ===== ثوابت خط التصنيع =====
export const ROAST_DEGREES = ['فاتح', 'وسط', 'غامق', 'محروق'] as const
export const GRIND_LEVELS = ['ناعم جداً', 'ناعم', 'متوسط', 'خشن'] as const

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma

// رقم تشغيلة متسلسل لكل مرحلة (TSH تحميص / TLF توليف / THN طحن)
export async function nextBatchNo(tx: Tx, prefix: string): Promise<string> {
  const count = await (tx as typeof prisma).production.count({ where: { batchNo: { startsWith: prefix + '-' } } })
  return `${prefix}-${String(count + 1).padStart(4, '0')}`
}

// مرحلة مخزنية بالاسم (بحث جزئي)
export async function stageByName(tx: Tx, kw: string) {
  return (tx as typeof prisma).stockStage.findFirst({ where: { name: { contains: kw } } })
}

// بيشيل بادئة "بن أخضر" من اسم الأصل عشان اسم المحمص ما يفضلش شايل "أخضر" وهو بقى محمص
export function stripGreenPrefix(name: string) {
  return name.replace(/^بن\s*أخضر\s*—?\s*/, '')
}

// منتج وسيط "محمص بدرجة" لكل أصل أخضر — يتعمل تلقائي أول تحميصة
// الاسم: "{الأصل} — محمص ({الدرجة})" | itemKind=ROASTED | مرحلة بن محمّص
export async function ensureRoastedVariant(tx: Tx, green: { id: string; name: string }, degree: string) {
  const name = `${stripGreenPrefix(green.name)} — محمص (${degree})`
  const ex = await (tx as typeof prisma).product.findFirst({ where: { name } })
  if (ex) return ex
  const roastedStage = await stageByName(tx, 'محمّص')
  return (tx as typeof prisma).product.create({
    data: {
      name,
      type: 'RAW',
      itemKind: 'ROASTED',
      stageId: roastedStage?.id || null,
      unit: 'كجم',
      costPrice: 0,
      sellPrice: 0,
      quantity: 0,
    },
  })
}

// منتج وسيط "حبوب التوليفة المحمصة" (ناتج التوليف قبل الطحن) — blendId بيشاور على التوليفة الأم
export async function ensureRoastedBlendBeans(tx: Tx, blend: { id: string; name: string }) {
  const name = `${blend.name} (حبوب محمصة)`
  const ex = await (tx as typeof prisma).product.findFirst({ where: { name } })
  if (ex) return ex
  const roastedStage = await stageByName(tx, 'محمّص')
  return (tx as typeof prisma).product.create({
    data: {
      name,
      type: 'RAW',
      itemKind: 'ROASTED_BLEND',
      stageId: roastedStage?.id || null,
      blendId: blend.id, // يربط الحبوب بالتوليفة الأم — الطحن يعرف يطلع إيه
      unit: 'كجم',
      costPrice: 0,
      sellPrice: 0,
      quantity: 0,
    },
  })
}

// ناتج طحن محمص أصل واحد (مش توليفة): "{الاسم} — مطحون"
export async function ensureGroundVariant(tx: Tx, roasted: { id: string; name: string }) {
  const name = `${roasted.name} — مطحون`
  const ex = await (tx as typeof prisma).product.findFirst({ where: { name } })
  if (ex) return ex
  const groundStage = await stageByName(tx, 'مطحون')
  return (tx as typeof prisma).product.create({
    data: {
      name,
      type: 'RAW',
      itemKind: 'GROUND',
      stageId: groundStage?.id || null,
      unit: 'كجم',
      costPrice: 0,
      sellPrice: 0,
      quantity: 0,
    },
  })
}

// حد الهدر الأقصى المسموح لعملية معيّنة (بالاسم: تحميص/طحن/تعبئة) — 0 يعني مفيش حد
export async function wasteThresholdFor(tx: Tx, kw: string): Promise<number> {
  const op = await (tx as typeof prisma).productionOperation.findFirst({ where: { isActive: true, name: { contains: kw } } })
  return op ? Number(op.maxWastePercent) : 0
}

// فحص تجاوز الهدر: يعلّم التشغيلة + إشعار للأدمن في سجل الحوكمة/لوحة التحكم
export async function flagWasteIfExceeded(
  tx: Tx,
  productionId: string,
  opKeyword: string,
  wastePct: number,
  detail: { batchNo: string; userId: string; desc: string }
): Promise<boolean> {
  const limit = await wasteThresholdFor(tx, opKeyword)
  if (!(limit > 0) || wastePct <= limit) return false
  await (tx as typeof prisma).production.update({ where: { id: productionId }, data: { wasteExceeded: true } })
  await (tx as typeof prisma).auditLog.create({
    data: {
      userId: detail.userId,
      action: 'تجاوز حد الهدر',
      description: `⚠️ تشغيلة ${detail.batchNo}: ${detail.desc}`,
      impact: `هدر ${wastePct.toFixed(2)}% أعلى من الحد المسموح (${limit}%)`,
    },
  })
  return true
}

// تحقق وصفة التوليفة: مجموع نسب كل المكوّنات (بن + عطارة + نكهات) لازم = 100% بالظبط
export function validateBlendPercents(components: { percent?: number }[]): string | null {
  const active = components.filter((c) => (Number(c.percent) || 0) > 0)
  if (active.length === 0) return 'الوصفة لازم فيها مكوّن واحد على الأقل بنسبة'
  const sum = +active.reduce((s, c) => s + (Number(c.percent) || 0), 0).toFixed(3)
  if (sum !== 100) return `مجموع نسب المكوّنات لازم يساوي 100% بالظبط (الحالي: ${sum}%)`
  return null
}
