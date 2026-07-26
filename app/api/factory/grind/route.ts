import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { GRIND_LEVELS, ensureGroundVariant, nextBatchNo, flagWasteIfExceeded } from '@/lib/manufacturing'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// المرحلة ٣ — الطحن: حبوب محمصة (توليفة أو أصل واحد) ← بن مطحون بنعومة محددة، بهدر محسوب.
// لو المدخل "حبوب توليفة" → الناتج هو منتج التوليفة المطحونة نفسه (الجاهز للتعبئة).
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const inputKg = Math.round(Number(b.inputKg))
    const outputKg = Math.round(Number(b.outputKg))
    const fineness = String(b.fineness || '')
    const channel = b.channel || 'المصنع'

    if (!b.inputProductId || !(inputKg > 0) || !(outputKg > 0)) {
      return NextResponse.json({ error: 'اختار الحبوب المحمصة واكتب وزن الداخل والخارج' }, { status: 400 })
    }
    if (!GRIND_LEVELS.includes(fineness as any)) {
      return NextResponse.json({ error: `درجة النعومة لازم تكون: ${GRIND_LEVELS.join(' / ')}` }, { status: 400 })
    }
    if (outputKg > inputKg) {
      return NextResponse.json({ error: 'وزن المطحون الخارج مينفعش يزيد عن الداخل' }, { status: 400 })
    }

    const input = await prisma.product.findUnique({ where: { id: b.inputProductId }, include: { blend: true } })
    if (!input || !['ROASTED', 'ROASTED_BLEND'].includes(input.itemKind)) {
      return NextResponse.json({ error: 'المدخل لازم يكون حبوب محمصة (من مرحلة التحميص أو التوليف)' }, { status: 400 })
    }

    const inWh = await warehouseForStage(input.stageId)
    const stock = await getStock(inWh, input.id)
    if (stock < inputKg) {
      return NextResponse.json({ error: `رصيد ${input.name} غير كافي (المتاح: ${stock} كجم)` }, { status: 400 })
    }

    const wasteKg = inputKg - outputKg
    const wastePct = +((wasteKg / inputKg) * 100).toFixed(2)

    const production = await prisma.$transaction(async (tx) => {
      // الناتج: توليفة مطحونة (المنتج الأم) أو "أصل — مطحون"
      const output = input.itemKind === 'ROASTED_BLEND' && input.blend
        ? input.blend
        : await ensureGroundVariant(tx, input)
      const outWh = await warehouseForStage(output.stageId)
      const batchNo = await nextBatchNo(tx, 'THN')

      const created = await tx.production.create({
        data: {
          orderNo: `GRD-${Date.now()}`,
          lineType: 'PROCESSING',
          stage: `طحن ${fineness} — ${output.name}`,
          batchNo,
          grindType: fineness,
          inputWeight: inputKg,
          outputWeight: outputKg,
          wasteWeight: wasteKg,
          wastePercent: wastePct,
          channel,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          inputs: { create: [{ productId: input.id, quantity: inputKg, percentage: 100 }] },
          items: { create: [{ productId: output.id, quantity: outputKg }] },
        },
        include: { items: { include: { product: true } } },
      })

      await tx.product.update({ where: { id: input.id }, data: { quantity: { decrement: inputKg } } })
      await adjustStock(tx, inWh, input.id, -inputKg)
      await tx.product.update({ where: { id: output.id }, data: { quantity: { increment: outputKg } } })
      await adjustStock(tx, outWh, output.id, outputKg)

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'طحن',
          description: `تشغيلة ${batchNo}: طحن ${inputKg} كجم ${input.name} (${fineness}) — ${channel}`,
          impact: `خرج ${outputKg} كجم مطحون · هدر ${wasteKg} كجم (${wastePct}%)`,
        },
      })

      // فحص حد الهدر المسموح للطحن
      await flagWasteIfExceeded(tx, created.id, 'طحن', wastePct, {
        batchNo,
        userId: session.user.id,
        desc: `طحن ${input.name} (${fineness}) — دخل ${inputKg} خرج ${outputKg} كجم`,
      })
      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تسجيل الطحن' }, { status: 500 })
  }
}
