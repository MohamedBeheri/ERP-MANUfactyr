import { prisma } from '@/lib/prisma'

// ===== ثوابت خط التصنيع =====
export const ROAST_DEGREES = ['فاتح', 'وسط', 'غامق', 'غامق جداً'] as const
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

// منتج وسيط "محمص بدرجة" لكل أصل أخضر — يتعمل تلقائي أول تحميصة
// الاسم: "{الأصل} — محمص ({الدرجة})" | itemKind=ROASTED | مرحلة بن محمّص
export async function ensureRoastedVariant(tx: Tx, green: { id: string; name: string }, degree: string) {
  const name = `${green.name} — محمص (${degree})`
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

// تحقق وصفة التوليفة: مجموع نسب مكوّنات البن لازم = 100% بالظبط
export function validateBlendPercents(components: { percent?: number; perKilo?: number }[]): string | null {
  const coffeeComps = components.filter((c) => (Number(c.percent) || 0) > 0)
  if (coffeeComps.length === 0) return 'الوصفة لازم فيها مكوّن بن واحد على الأقل بنسبة مئوية'
  const sum = +coffeeComps.reduce((s, c) => s + (Number(c.percent) || 0), 0).toFixed(3)
  if (sum !== 100) return `مجموع نسب البن في الوصفة لازم يساوي 100% بالظبط (الحالي: ${sum}%)`
  return null
}
