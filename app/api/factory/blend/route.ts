import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { ensureRoastedBlendBeans, ensureRoastedVariant, nextBatchNo, validateBlendPercents } from '@/lib/manufacturing'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// المرحلة ٢ — التوليف: خلط البن المحمص بنسب الوصفة (٧٠٪ إندونيسي فاتح + ١٥٪ برازيلي وسط...).
// السيرفر يمنع التنفيذ لو مجموع نسب البن ≠ 100%. المدخلات من مخزون المحمص (لازم تحميص الأول).
// الناتج: "حبوب التوليفة المحمصة" — تتطحن في المرحلة الجاية.
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const outputKg = Math.round(Number(b.outputKg))
    const channel = b.channel || 'المصنع'
    if (!b.blendId || !(outputKg > 0)) {
      return NextResponse.json({ error: 'اختار التوليفة واكتب الكمية المطلوبة' }, { status: 400 })
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

    // مدخلات البن: المحمص بدرجة الوصفة (مش الأخضر) — التحميص حصل في المرحلة ١
    const coffeeInputs: { productId: string; name: string; kg: number; whId: string; pct: number }[] = []
    for (const c of coffeeComps) {
      const degree = c.roastDegree || 'وسط'
      const roasted = await ensureRoastedVariant(prisma, c.component, degree)
      const kg = Math.round((outputKg * Number(c.percent)) / 100)
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

    const production = await prisma.$transaction(async (tx) => {
      const beans = await ensureRoastedBlendBeans(tx, blend)
      const beansWh = await warehouseForStage(beans.stageId)
      const batchNo = await nextBatchNo(tx, 'TLF')
      const totalIn = coffeeInputs.reduce((s, i) => s + i.kg, 0) + spiceInputs.reduce((s, i) => s + i.kg, 0)

      const created = await tx.production.create({
        data: {
          orderNo: `BLD-${Date.now()}`,
          lineType: 'PROCESSING',
          stage: `توليف — ${blend.name}`,
          batchNo,
          inputWeight: totalIn,
          outputWeight: outputKg,
          wasteWeight: Math.max(0, totalIn - outputKg),
          wastePercent: totalIn > 0 ? +(((Math.max(0, totalIn - outputKg)) / totalIn) * 100).toFixed(2) : 0,
          channel,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          inputs: {
            create: [
              ...coffeeInputs.map((i) => ({ productId: i.productId, quantity: i.kg, percentage: i.pct })),
              ...spiceInputs.map((i) => ({ productId: i.productId, quantity: i.kg, percentage: 0 })),
            ],
          },
          items: { create: [{ productId: beans.id, quantity: outputKg }] },
        },
        include: { items: { include: { product: true } } },
      })

      for (const inp of [...coffeeInputs, ...spiceInputs]) {
        await tx.product.update({ where: { id: inp.productId }, data: { quantity: { decrement: inp.kg } } })
        await adjustStock(tx, inp.whId, inp.productId, -inp.kg)
      }
      await tx.product.update({ where: { id: beans.id }, data: { quantity: { increment: outputKg } } })
      await adjustStock(tx, beansWh, beans.id, outputKg)

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'توليف',
          description: `تشغيلة ${batchNo}: توليف ${outputKg} كجم ${blend.name} — ${channel}`,
          impact: coffeeInputs.map((i) => `${i.pct}% ${i.name}`).join(' + '),
        },
      })
      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تنفيذ التوليف' }, { status: 500 })
  }
}
