import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock, getDefaultWarehouseId } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// إنتاج توليفة: من البن الأخضر (مضروبًا في نسبة الخسران) + العطارة (بالجرعة) → توليفة جاهزة.
// المطلوب من كل بن أخضر = (الناتج × النسبة) ÷ (1 − نسبة الخسران).
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const outputKg = Math.round(Number(b.outputKg) || 0)
    if (!b.blendId || outputKg <= 0) return NextResponse.json({ error: 'اختار التوليفة والكمية الناتجة' }, { status: 400 })

    const blend = await prisma.product.findUnique({
      where: { id: b.blendId },
      include: { blendComponents: { include: { component: true } } },
    })
    if (!blend || blend.itemKind !== 'BLEND') return NextResponse.json({ error: 'التوليفة غير صحيحة' }, { status: 400 })
    if (blend.blendComponents.length === 0) return NextResponse.json({ error: 'التوليفة دي ملهاش وصفة — عرّفها في بنك الأصناف' }, { status: 400 })

    // حساب المطلوب من كل مكوّن
    const inputs = blend.blendComponents.map((c) => {
      const loss = Number(c.component.roastLossPercent) / 100
      const isGreen = c.component.itemKind === 'GREEN'
      const kg = isGreen
        ? (outputKg * Number(c.percent)) / 100 / (loss < 1 ? 1 - loss : 1) // البن الأخضر مضروب في الخسران
        : (outputKg * Number(c.perKilo)) / 1000 // العطارة بالجرعة لكل كيلو
      return { productId: c.componentId, name: c.component.name, stageId: c.component.stageId, unit: c.component.unit, kg: Math.round(kg) }
    }).filter((i) => i.kg > 0)

    const fallbackWh = b.warehouseId || (await getDefaultWarehouseId())
    // تحقق من الرصيد
    for (const inp of inputs) {
      const wh = inp.stageId ? await warehouseForStage(inp.stageId) : fallbackWh
      const stock = await getStock(wh, inp.productId)
      if (stock < inp.kg) {
        return NextResponse.json({ error: `رصيد ${inp.name} غير كافي (متاح ${stock}، مطلوب ${inp.kg} ${inp.unit})` }, { status: 400 })
      }
    }

    const totalInput = inputs.reduce((s, i) => s + i.kg, 0)
    const waste = Math.max(0, totalInput - outputKg)
    const wastePercent = totalInput > 0 ? (waste / totalInput) * 100 : 0
    const blendWh = blend.stageId ? await warehouseForStage(blend.stageId) : fallbackWh

    const production = await prisma.$transaction(async (tx) => {
      const created = await tx.production.create({
        data: {
          orderNo: `BLND-${Date.now()}`,
          lineType: 'ROASTING',
          stage: `إنتاج توليفة — ${blend.name}`,
          batchNo: b.batchNo || null,
          inputWeight: totalInput,
          outputWeight: outputKg,
          wasteWeight: waste,
          wastePercent,
          rawProductId: inputs[0]?.productId || null,
          rawUsed: totalInput,
          notes: b.notes || null,
          createdById: session.user.id,
          inputs: { create: inputs.map((i) => ({ productId: i.productId, quantity: i.kg, percentage: totalInput > 0 ? Number(((i.kg / totalInput) * 100).toFixed(2)) : 0 })) },
          items: { create: [{ productId: blend.id, quantity: outputKg }] },
        },
      })

      for (const inp of inputs) {
        const wh = inp.stageId ? await warehouseForStage(inp.stageId) : fallbackWh
        await tx.product.update({ where: { id: inp.productId }, data: { quantity: { decrement: inp.kg } } })
        await adjustStock(tx, wh, inp.productId, -inp.kg)
        await tx.warehouseOut.create({ data: { productId: inp.productId, warehouseId: wh, quantity: inp.kg, target: 'إنتاج توليفة', reason: `أمر ${created.orderNo}`, createdById: session.user.id } })
      }
      await tx.product.update({ where: { id: blend.id }, data: { quantity: { increment: outputKg } } })
      await adjustStock(tx, blendWh, blend.id, outputKg)
      await tx.warehouseIn.create({ data: { productId: blend.id, warehouseId: blendWh, quantity: outputKg, source: `إنتاج توليفة — أمر ${created.orderNo}`, createdById: session.user.id } })

      await tx.auditLog.create({ data: { userId: session.user.id, action: 'إنتاج توليفة', description: `${created.orderNo} — ${blend.name} ${outputKg} كجم`, impact: `مدخل ${totalInput} / ناتج ${outputKg} / هدر ${waste} (${wastePercent.toFixed(1)}%)` } })
      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إنتاج التوليفة' }, { status: 500 })
  }
}
