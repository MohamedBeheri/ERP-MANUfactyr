import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { flagWasteIfExceeded } from '@/lib/manufacturing'


// إقفال تشغيلة الطحن والتوليف: العامل يرجع بعد ما الماكينة تخلص ويوزن الناتج،
// النظام يضيف المطحون النهائي للمخزن ويحسب الهدر الفعلي.
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('factory', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;
  const { session } = auth

  try {
    const b = await req.json()
    const outputKg = Math.round(Number(b.outputKg) * 1000) / 1000
    if (!(outputKg > 0)) return NextResponse.json({ error: 'اكتب الوزن الفعلي للمطحون الخارج' }, { status: 400 })

    const production = await prisma.production.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: true } } },
    })
    if (!production) return NextResponse.json({ error: 'التشغيلة غير موجودة' }, { status: 404 })
    if (production.status !== 'PENDING') return NextResponse.json({ error: 'التشغيلة دي مقفولة بالفعل أو ملغية' }, { status: 400 })
    if (outputKg > Number(production.inputWeight)) {
      return NextResponse.json({ error: `الوزن الخارج (${outputKg}) مينفعش يزيد عن الداخل (${production.inputWeight})` }, { status: 400 })
    }

    const blendItem = production.items[0]
    if (!blendItem) return NextResponse.json({ error: 'التشغيلة مفيهاش صنف ناتج' }, { status: 400 })

    const wasteKg = Number(production.inputWeight) - outputKg
    const wastePct = Number(production.inputWeight) > 0 ? +((wasteKg / Number(production.inputWeight)) * 100).toFixed(2) : 0
    const blendWh = await warehouseForStage(blendItem.product.stageId)

    await prisma.$transaction(async (tx) => {
      await tx.production.update({
        where: { id: production.id },
        data: {
          outputWeight: outputKg,
          wasteWeight: wasteKg,
          wastePercent: wastePct,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
      await tx.productionItem.update({ where: { id: blendItem.id }, data: { quantity: outputKg } })
      await tx.product.update({ where: { id: blendItem.productId }, data: { quantity: { increment: outputKg } } })
      await adjustStock(tx, blendWh, blendItem.productId, outputKg)

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'إقفال طحن وتوليف',
          description: `إقفال تشغيلة ${production.batchNo}: ${blendItem.product.name} — وزن الناتج ${outputKg} كجم`,
          impact: `+${outputKg} كجم مطحون جاهز · هدر ${wasteKg} كجم (${wastePct}%)`,
        },
      })

      await flagWasteIfExceeded(tx, production.id, 'طحن', wastePct, {
        batchNo: production.batchNo || production.orderNo,
        userId: session.user.id,
        desc: `${production.stage} — دخل ${production.inputWeight} خرج ${outputKg} كجم`,
      })
    })

    return NextResponse.json({ success: true, wastePct })
  } catch {
    return NextResponse.json({ error: 'فشل إقفال التشغيلة' }, { status: 500 })
  }
}
