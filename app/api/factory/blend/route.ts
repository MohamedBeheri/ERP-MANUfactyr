import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { GRIND_LEVELS, ensureRoastedVariant, nextBatchNo, validateBlendPercents } from '@/lib/manufacturing'


// المرحلة ٢ — بدء طحن وتوليف (خطوة أولى):
// وضعين: (١) توليفة جاهزة (blendId) أو (٢) توليفة مخصصة (customComponents).
// المدخلات (محمص + عطارة + نكهات) تتخصم فورًا، وتتفتح تشغيلة PENDING.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('factory', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const plannedKg = Math.round(Number(b.plannedKg) * 1000) / 1000
    const fineness = String(b.fineness || '')
    const channel = b.channel || 'المصنع'

    if (!(plannedKg > 0)) {
      return NextResponse.json({ error: 'اكتب الكمية المخطط طحنها' }, { status: 400 })
    }
    if (!GRIND_LEVELS.includes(fineness as any)) {
      return NextResponse.json({ error: `درجة النعومة لازم تكون: ${GRIND_LEVELS.join(' / ')}` }, { status: 400 })
    }

    let blendProduct: any
    let activeComps: { componentId: string; component: any; percent: number; roastDegree: string | null }[] = []

    if (b.customBlend && Array.isArray(b.customComponents) && b.customComponents.length > 0) {
      // === وضع التوليفة المخصصة ===
      const comps = b.customComponents as { productId: string; percent: number }[]
      const invalid = validateBlendPercents(comps)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

      // تحميل بيانات المكوّنات
      const products = await prisma.product.findMany({
        where: { id: { in: comps.map((c) => c.productId) } },
      })
      const prodMap = new Map(products.map((p) => [p.id, p]))

      for (const c of comps) {
        if (!prodMap.has(c.productId)) {
          return NextResponse.json({ error: `المكوّن غير موجود` }, { status: 400 })
        }
      }

      // تحديد اسم التوليفة
      const blendName = b.blendName?.trim() || comps.map((c) => {
        const p = prodMap.get(c.productId)!
        return `${c.percent}% ${p.name}`
      }).join(' + ')

      // البحث عن توليفة بنفس الاسم أو إنشاء جديدة
      const existing = await prisma.product.findFirst({ where: { name: blendName, itemKind: 'BLEND' } })
      if (existing) {
        blendProduct = existing
      } else {
        const blendStage = await prisma.stockStage.findFirst({ where: { name: { contains: 'مطحون' } } })
        blendProduct = await prisma.product.create({
          data: {
            name: blendName,
            type: 'RAW',
            itemKind: 'BLEND',
            stageId: blendStage?.id || null,
            unit: 'كجم',
            costPrice: 0,
            sellPrice: 0,
            quantity: 0,
          },
        })
        // حفظ المكوّنات كـ BlendComponent عشان التوليفة تكون قابلة لإعادة الاستخدام
        await prisma.blendComponent.createMany({
          data: comps.map((c) => ({
            blendId: blendProduct.id,
            componentId: c.productId,
            percent: c.percent,
          })),
        })
      }

      activeComps = comps.map((c) => ({
        componentId: c.productId,
        component: prodMap.get(c.productId)!,
        percent: c.percent,
        roastDegree: null,
      }))

    } else if (b.blendId) {
      // === وضع التوليفة الجاهزة ===
      const blend = await prisma.product.findUnique({
        where: { id: b.blendId },
        include: { blendComponents: { include: { component: true } } },
      })
      if (!blend || blend.itemKind !== 'BLEND') {
        return NextResponse.json({ error: 'التوليفة غير موجودة' }, { status: 400 })
      }
      blendProduct = blend

      const rawComps = blend.blendComponents.filter((c) => Number(c.percent) > 0)
      const invalid = validateBlendPercents(rawComps.map((c) => ({ percent: Number(c.percent) })))
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

      activeComps = rawComps.map((c) => ({
        componentId: c.componentId,
        component: c.component,
        percent: Number(c.percent),
        roastDegree: c.roastDegree,
      }))

    } else {
      return NextResponse.json({ error: 'اختار توليفة جاهزة أو أضف مكوّنات مخصصة' }, { status: 400 })
    }

    // كل مكوّن: kg = plannedKg × نسبته٪ / 100. GREEN بيتحول لمحمص، الباقي بيستخدم مباشرة
    const allInputs: { productId: string; name: string; kg: number; whId: string; pct: number; kind: string }[] = []
    for (const c of activeComps) {
      const kg = Math.max(1, Math.round((plannedKg * c.percent) / 100))
      let productId = c.component.id
      let name = c.component.name
      let stageId = c.component.stageId

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
      allInputs.push({ productId, name, kg, whId, pct: c.percent, kind: c.component.itemKind })
    }

    const totalIn = allInputs.reduce((s, i) => s + i.kg, 0)

    const production = await prisma.$transaction(async (tx) => {
      const batchNo = await nextBatchNo(tx, 'TLF')

      const created = await tx.production.create({
        data: {
          orderNo: `BLD-${Date.now()}`,
          lineType: 'PROCESSING',
          stage: `طحن وتوليف (${fineness}) — ${blendProduct.name}`,
          batchNo,
          grindType: fineness,
          inputWeight: totalIn,
          expectedOutput: plannedKg, // الناتج المتوقع = الكمية المخطط طحنها
          outputWeight: 0,
          wasteWeight: 0,
          wastePercent: 0,
          channel,
          status: 'PENDING',
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          inputs: {
            create: allInputs.map((i) => ({ productId: i.productId, quantity: i.kg, percentage: i.pct })),
          },
          items: { create: [{ productId: blendProduct.id, quantity: 0 }] },
        },
        include: { items: { include: { product: true } } },
      })

      for (const inp of allInputs) {
        await tx.product.update({ where: { id: inp.productId }, data: { quantity: { decrement: inp.kg } } })
        await adjustStock(tx, inp.whId, inp.productId, -inp.kg)
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'بدء طحن وتوليف',
          description: `تشغيلة ${batchNo}: بدء طحن وتوليف ${plannedKg} كجم ${blendProduct.name} (${fineness}) — ${channel}`,
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
