import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { GRIND_LEVELS, ensureRoastedVariant, nextBatchNo, validateBlendPercents, flagWasteIfExceeded } from '@/lib/manufacturing'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// المرحلة ٢ — طحن وتوليف (خطوة واحدة): خلط البن المحمص بنسب الوصفة ثم طحنه بنعومة محددة.
// الناتج: منتج التوليفة المطحون مباشرة (جاهز للتعبئة) — بدون مرحلة وسيطة "حبوب توليفة".
// السيرفر يمنع الحفظ لو مجموع نسب البن ≠ 100%.
// المستخدم بيدخل الوزن الخارج الفعلي بعد الطحن → الفرق = هدر التوليف والطحن مجتمعين.
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const outputKg = Math.round(Number(b.outputKg)) // الوزن المطحون الخارج فعليًا
    const fineness = String(b.fineness || '')
    const channel = b.channel || 'المصنع'

    if (!b.blendId || !(outputKg > 0)) {
      return NextResponse.json({ error: 'اختار التوليفة واكتب الوزن المطحون الخارج' }, { status: 400 })
    }
    if (!GRIND_LEVELS.includes(fineness as any)) {
      return NextResponse.json({ error: `درجة النعومة لازم تكون: ${GRIND_LEVELS.join(' / ')}` }, { status: 400 })
    }

    const blend = await prisma.product.findUnique({
      where: { id: b.blendId },
      include: { blendComponents: { include: { component: true } } },
    })
    if (!blend || blend.itemKind !== 'BLEND') {
      return NextResponse.json({ error: 'التوليفة غير موجودة' }, { status: 400 })
    }

    const coffeeComps = blend.blendComponents.filter((c) => Number(c.percent) > 0)
    const spiceComps = blend.blendComponents.filter((c) => Number(c.perKilo) > 0)

    // ===== منع الحفظ لو المجموع ≠ 100% =====
    const invalid = validateBlendPercents(coffeeComps.map((c) => ({ percent: Number(c.percent) })))
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    // كمية البن المحمص المطلوبة تقريبًا = outputKg (بدون احتساب هدر بسيط في الطحن — الفرق بيتحسب من الوزن الفعلي)
    // بس نسحب حسب النسب من مخزون المحمص الموجود
    const targetTotal = outputKg
    const coffeeInputs: { productId: string; name: string; kg: number; whId: string; pct: number }[] = []
    for (const c of coffeeComps) {
      const degree = c.roastDegree || 'وسط'
      const roasted = await ensureRoastedVariant(prisma, c.component, degree)
      const kg = Math.max(1, Math.round((targetTotal * Number(c.percent)) / 100))
      const whId = await warehouseForStage(roasted.stageId)
      const stock = await getStock(whId, roasted.id)
      if (stock < kg) {
        return NextResponse.json(
          { error: `مخزون "${roasted.name}" غير كافي (المتاح: ${stock} / المطلوب: ${kg} كجم) — لازم تحمّص ${c.component.name} (${degree}) الأول في مرحلة التحميص.` },
          { status: 400 }
        )
      }
      coffeeInputs.push({ productId: roasted.id, name: roasted.name, kg, whId, pct: Number(c.percent) })
    }

    // العطارة/النكهات بجرعة لكل كيلو
    const spiceInputs: { productId: string; name: string; kg: number; whId: string }[] = []
    for (const c of spiceComps) {
      const kg = Math.max(1, Math.round(Number(c.perKilo) * outputKg))
      const whId = await warehouseForStage(c.component.stageId)
      const stock = await getStock(whId, c.component.id)
      if (stock < kg) {
        return NextResponse.json({ error: `مخزون ${c.component.name} غير كافي (المتاح: ${stock} / المطلوب: ${kg})` }, { status: 400 })
      }
      spiceInputs.push({ productId: c.component.id, name: c.component.name, kg, whId })
    }

    const totalIn = coffeeInputs.reduce((s, i) => s + i.kg, 0) + spiceInputs.reduce((s, i) => s + i.kg, 0)
    const wasteKg = Math.max(0, totalIn - outputKg)
    const wastePct = totalIn > 0 ? +((wasteKg / totalIn) * 100).toFixed(2) : 0

    const production = await prisma.$transaction(async (tx) => {
      // ناتج التوليف والطحن = منتج التوليفة نفسه (مطحون، جاهز للتعبئة)
      const blendWh = await warehouseForStage(blend.stageId)
      const batchNo = await nextBatchNo(tx, 'TLF')

      const created = await tx.production.create({
        data: {
          orderNo: `BLD-${Date.now()}`,
          lineType: 'PROCESSING',
          stage: `طحن وتوليف (${fineness}) — ${blend.name}`,
          batchNo,
          grindType: fineness,
          inputWeight: totalIn,
          outputWeight: outputKg,
          wasteWeight: wasteKg,
          wastePercent: wastePct,
          channel,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          inputs: {
            create: [
              ...coffeeInputs.map((i) => ({ productId: i.productId, quantity: i.kg, percentage: i.pct })),
              ...spiceInputs.map((i) => ({ productId: i.productId, quantity: i.kg, percentage: 0 })),
            ],
          },
          items: { create: [{ productId: blend.id, quantity: outputKg }] },
        },
        include: { items: { include: { product: true } } },
      })

      for (const inp of [...coffeeInputs, ...spiceInputs]) {
        await tx.product.update({ where: { id: inp.productId }, data: { quantity: { decrement: inp.kg } } })
        await adjustStock(tx, inp.whId, inp.productId, -inp.kg)
      }
      // إضافة المطحون النهائي لمخزن المطحون/التوليفات
      await tx.product.update({ where: { id: blend.id }, data: { quantity: { increment: outputKg } } })
      await adjustStock(tx, blendWh, blend.id, outputKg)

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'طحن وتوليف',
          description: `تشغيلة ${batchNo}: طحن وتوليف ${outputKg} كجم ${blend.name} (${fineness}) — ${channel}`,
          impact: `${coffeeInputs.map((i) => `${i.pct}% ${i.name}`).join(' + ')} · هدر ${wasteKg} كجم (${wastePct}%)`,
        },
      })

      // فحص حد الهدر لعملية "طحن وتوليف" (fallback على "طحن" لو مش موجود اسم مطابق)
      await flagWasteIfExceeded(tx, created.id, 'طحن', wastePct, {
        batchNo,
        userId: session.user.id,
        desc: `طحن وتوليف ${blend.name} (${fineness}) — دخل ${totalIn} خرج ${outputKg} كجم`,
      })
      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تنفيذ طحن وتوليف' }, { status: 500 })
  }
}
