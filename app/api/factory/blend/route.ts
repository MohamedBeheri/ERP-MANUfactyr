import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { GRIND_LEVELS, ensureRoastedVariant, nextBatchNo, validateBlendPercents } from '@/lib/manufacturing'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// المرحلة ٢ — بدء طحن وتوليف (خطوة أولى):
// العامل بيختار التوليفة والكمية المخطط طحنها ودرجة النعومة → المدخلات (محمص + عطارة) تتخصم فورًا،
// وتتفتح تشغيلة PENDING. يرجع بعد ساعة/ساعتين ويوزن الناتج في /complete.
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const plannedKg = Math.round(Number(b.plannedKg)) // الكمية المخطط طحنها (تحدد كمية المدخلات)
    const fineness = String(b.fineness || '')
    const channel = b.channel || 'المصنع'

    if (!b.blendId || !(plannedKg > 0)) {
      return NextResponse.json({ error: 'اختار التوليفة والكمية المخطط طحنها' }, { status: 400 })
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

    const activeComps = blend.blendComponents.filter((c) => Number(c.percent) > 0)

    // تحقق: مجموع نسب كل المكوّنات (بن + عطارة + نكهات) لازم = 100%
    const invalid = validateBlendPercents(activeComps.map((c) => ({ percent: Number(c.percent) })))
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    // كل مكوّن: kg = plannedKg × نسبته٪ / 100. GREEN بيتحول لمحمص، الباقي (SPICE/FLAVOR/ROASTED) بيستخدم مباشرة
    const allInputs: { productId: string; name: string; kg: number; whId: string; pct: number; kind: string }[] = []
    for (const c of activeComps) {
      const kg = Math.max(1, Math.round((plannedKg * Number(c.percent)) / 100))
      let productId = c.component.id
      let name = c.component.name
      let stageId = c.component.stageId

      // GREEN: نستخدم المحمص بدرجته (زي ما اتحمّص في مرحلة التحميص)
      if (c.component.itemKind === 'GREEN') {
        const degree = c.roastDegree || 'وسط'
        const roasted = await ensureRoastedVariant(prisma, c.component, degree)
        productId = roasted.id; name = roasted.name; stageId = roasted.stageId
      }

      const whId = await warehouseForStage(stageId)
      const stock = await getStock(whId, productId)
      if (stock < kg) {
        return NextResponse.json(
          { error: `مخزون "${name}" غير كافي (المتاح: ${stock} / المطلوب: ${kg} كجم)${c.component.itemKind === 'GREEN' ? ` — لازم تحمّص الأول` : ''}.` },
          { status: 400 }
        )
      }
      allInputs.push({ productId, name, kg, whId, pct: Number(c.percent), kind: c.component.itemKind })
    }

    const totalIn = allInputs.reduce((s, i) => s + i.kg, 0)

    const production = await prisma.$transaction(async (tx) => {
      const batchNo = await nextBatchNo(tx, 'TLF')

      const created = await tx.production.create({
        data: {
          orderNo: `BLD-${Date.now()}`,
          lineType: 'PROCESSING',
          stage: `طحن وتوليف (${fineness}) — ${blend.name}`,
          batchNo,
          grindType: fineness,
          inputWeight: totalIn,
          outputWeight: 0, // لسه ما اتقفلتش
          wasteWeight: 0,
          wastePercent: 0,
          channel,
          status: 'PENDING',
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          inputs: {
            create: allInputs.map((i) => ({ productId: i.productId, quantity: i.kg, percentage: i.pct })),
          },
          items: { create: [{ productId: blend.id, quantity: 0 }] }, // placeholder
        },
        include: { items: { include: { product: true } } },
      })

      // خصم المدخلات فورًا (الماكينة اشتغلت)
      for (const inp of allInputs) {
        await tx.product.update({ where: { id: inp.productId }, data: { quantity: { decrement: inp.kg } } })
        await adjustStock(tx, inp.whId, inp.productId, -inp.kg)
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'بدء طحن وتوليف',
          description: `تشغيلة ${batchNo}: بدء طحن وتوليف ${plannedKg} كجم ${blend.name} (${fineness}) — ${channel}`,
          impact: `−${totalIn} كجم مدخلات · بانتظار إقفال التشغيلة`,
        },
      })
      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل بدء الطحن والتوليف' }, { status: 500 })
  }
}
