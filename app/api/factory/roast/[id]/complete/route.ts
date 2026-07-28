import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { flagWasteIfExceeded } from '@/lib/manufacturing'


// إقفال تشغيلة التحميص: العامل بيرجع بعد ساعة/ساعتين ويوزن الناتج،
// النظام يضيف المحمص للمخزن ويحسب الهدر الفعلي = المدخل − المخرج.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('factory', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const outputKg = Math.round(Number(b.outputKg))
    if (!(outputKg > 0)) return NextResponse.json({ error: 'اكتب الوزن الفعلي بعد التحميص' }, { status: 400 })

    const production = await prisma.production.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: true } } },
    })
    if (!production) return NextResponse.json({ error: 'التشغيلة غير موجودة' }, { status: 404 })
    if (production.status !== 'PENDING') return NextResponse.json({ error: 'التشغيلة دي مقفولة بالفعل أو ملغية' }, { status: 400 })
    if (outputKg > production.inputWeight) {
      return NextResponse.json({ error: `الوزن الخارج (${outputKg}) مينفعش يزيد عن الداخل (${production.inputWeight})` }, { status: 400 })
    }

    const roastedItem = production.items[0]
    if (!roastedItem) return NextResponse.json({ error: 'التشغيلة مفيهاش صنف ناتج' }, { status: 400 })

    const wasteKg = production.inputWeight - outputKg
    const wastePct = production.inputWeight > 0 ? +((wasteKg / production.inputWeight) * 100).toFixed(2) : 0
    const roastedWh = await warehouseForStage(roastedItem.product.stageId)

    await prisma.$transaction(async (tx) => {
      // تحديث التشغيلة
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
      // تحديث الكمية على بند الناتج
      await tx.productionItem.update({ where: { id: roastedItem.id }, data: { quantity: outputKg } })
      // إضافة الناتج لمخزن التحميص
      await tx.product.update({ where: { id: roastedItem.productId }, data: { quantity: { increment: outputKg } } })
      await adjustStock(tx, roastedWh, roastedItem.productId, outputKg)

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'إقفال تحميص',
          description: `إقفال تشغيلة ${production.batchNo}: ${roastedItem.product.name} — وزن الناتج ${outputKg} كجم`,
          impact: `+${outputKg} كجم لمخزن التحميص · هدر ${wasteKg} كجم (${wastePct}%)`,
        },
      })

      // فحص حد الهدر
      await flagWasteIfExceeded(tx, production.id, 'تحميص', wastePct, {
        batchNo: production.batchNo || production.orderNo,
        userId: session.user.id,
        desc: `${production.stage} — دخل ${production.inputWeight} خرج ${outputKg} كجم`,
      })
    })

    return NextResponse.json({ success: true, wastePct })
  } catch (e: any) {
    return NextResponse.json({ error: 'فشل إقفال التشغيلة: ' + (e?.message || 'unknown') }, { status: 500 })
  }
}
