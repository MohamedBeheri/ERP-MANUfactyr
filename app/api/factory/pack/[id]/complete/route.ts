import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { flagWasteIfExceeded } from '@/lib/manufacturing'


// إقفال تشغيلة التعبئة: العامل يرجع بعد ما خط التعبئة يخلص ويعد الأكياس الفعلية.
// النظام يحسب الهدر تلقائي:
//   هدر = (كمية مسحوبة بالجرام) - (عدد أكياس × وزن الكيس بالجرام) - (عدد أكياس × وزن الفارغة)
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('factory', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;
  const { session } = auth

  try {
    const b = await req.json()
    const actualBags = Math.round(Number(b.actualBags))
    if (!(actualBags > 0)) return NextResponse.json({ error: 'اكتب عدد الأكياس/العبوات الفعلية' }, { status: 400 })

    const production = await prisma.production.findUnique({
      where: { id: params.id },
      include: {
        items: { include: { product: { include: { packaging: true } } } },
        inputs: { include: { product: true } },
      },
    })
    if (!production) return NextResponse.json({ error: 'التشغيلة غير موجودة' }, { status: 404 })
    if (production.status !== 'PENDING') return NextResponse.json({ error: 'التشغيلة دي مقفولة بالفعل أو ملغية' }, { status: 400 })

    const finItem = production.items[0]
    if (!finItem) return NextResponse.json({ error: 'التشغيلة مفيهاش صنف ناتج' }, { status: 400 })

    const finProduct = finItem.product
    const gramsPerPiece = Number(finProduct.gramsPerPiece) || 0
    const tareWeight = Number(finProduct.packaging?.tareWeight || 0)
    const pullGrams = production.inputWeight * 1000

    // حساب الهدر التلقائي
    const coffeeUsedGrams = actualBags * gramsPerPiece
    const tareUsedGrams = actualBags * tareWeight
    const wasteGrams = pullGrams - coffeeUsedGrams - tareUsedGrams
    const wasteKg = Math.max(0, wasteGrams / 1000)
    const outputKg = coffeeUsedGrams / 1000
    const wastePct = production.inputWeight > 0 ? +((wasteKg / production.inputWeight) * 100).toFixed(2) : 0

    const finWh = await warehouseForStage(finProduct.stageId)

    await prisma.$transaction(async (tx) => {
      await tx.production.update({
        where: { id: production.id },
        data: {
          outputWeight: actualBags,
          wasteWeight: wasteKg,
          wastePercent: wastePct,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
      await tx.productionItem.update({ where: { id: finItem.id }, data: { quantity: actualBags } })

      // إضافة المنتج النهائي للمخزن
      await tx.product.update({ where: { id: finProduct.id }, data: { quantity: { increment: actualBags } } })
      await adjustStock(tx, finWh, finProduct.id, actualBags)

      await tx.warehouseIn.create({
        data: {
          productId: finProduct.id,
          warehouseId: finWh,
          quantity: actualBags,
          source: `تعبئة — أمر ${production.orderNo}`,
          createdById: session.user.id,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'إقفال تعبئة',
          description: `إقفال تشغيلة ${production.batchNo}: ${finProduct.name} — ${actualBags} عبوة`,
          impact: `+${actualBags} عبوة · هدر ${wasteKg.toFixed(1)} كجم (${wastePct}%) · بن فعلي ${(outputKg).toFixed(2)} كجم`,
        },
      })

      await flagWasteIfExceeded(tx, production.id, 'تعبئة', wastePct, {
        batchNo: production.batchNo || production.orderNo,
        userId: session.user.id,
        desc: `تعبئة ${finProduct.name} — ${actualBags} عبوة (هدر ${wasteKg.toFixed(1)} كجم)`,
      })
    })

    return NextResponse.json({
      success: true,
      actualBags,
      wasteKg: +wasteKg.toFixed(3),
      wastePct,
      coffeeUsedKg: +(outputKg).toFixed(3),
      tareUsedKg: +(tareUsedGrams / 1000).toFixed(3),
    })
  } catch {
    return NextResponse.json({ error: 'فشل إقفال تشغيلة التعبئة' }, { status: 500 })
  }
}
