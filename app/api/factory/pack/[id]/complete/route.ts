import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock, getDefaultWarehouseId } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { flagWasteIfExceeded } from '@/lib/manufacturing'


// إقفال تشغيلة التعبئة: المشغّل يبلّغ عند الإقفال:
//   • عدد الأكياس الفعلية
//   • وزن البن المتبقي (كجم) — بيرجع لمخزن المطحون اللي اتسحب منه
//   • وزن الرول المتبقي (كجم) — بيرجع لمخزن الرول اللي اتسحب منه
//   • وزن الفارغ الفعلي للكيس (جرام) — اختياري، لتقرير الجودة (بديل التقديري من بنك الأصناف)
// الهدر = (البن المستهلك فعلاً − البن اللي دخل الأكياس) + (الرول المستهلك فعلاً − الرول اللي دخل الأكياس)
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('factory', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;
  const { session } = auth

  try {
    const b = await req.json()
    const actualBags = Math.round(Number(b.actualBags) * 1000) / 1000
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
    const pullKg = Number(production.inputWeight) // البن المسحوب

    const rollInputKg = Number(production.rollInputKg || 0)
    const rollProduct = production.rollProductId
      ? await prisma.product.findUnique({ where: { id: production.rollProductId } })
      : finProduct.packaging
    // وزن الكيس الفاضي (الفيلم) المستهلك لكل كيس — بيُخصم من الوزن الإجمالي المعبأ للوصول لصافي البن
    const pieceWeight = Number(rollProduct?.tareWeight || finProduct.packaging?.tareWeight || 0)
    const netCoffeePerBag = Math.max(0, gramsPerPiece - pieceWeight)

    // البن المتبقي الراجع للمخزن (كجم)
    const remCoffeeRaw = b.remainingCoffeeKg !== undefined && b.remainingCoffeeKg !== null && String(b.remainingCoffeeKg).trim() !== ''
      ? Number(b.remainingCoffeeKg) : 0
    if (!(remCoffeeRaw >= 0 && isFinite(remCoffeeRaw))) return NextResponse.json({ error: 'وزن البن المتبقي لازم يكون رقم بالكجم' }, { status: 400 })
    if (remCoffeeRaw > pullKg) return NextResponse.json({ error: `وزن البن المتبقي (${remCoffeeRaw}) مينفعش يزيد عن المسحوب (${pullKg})` }, { status: 400 })

    // الرول المتبقي الراجع للمخزن (كجم)
    const remRollRaw = b.remainingRollKg !== undefined && b.remainingRollKg !== null && String(b.remainingRollKg).trim() !== ''
      ? Number(b.remainingRollKg) : 0
    if (!(remRollRaw >= 0 && isFinite(remRollRaw))) return NextResponse.json({ error: 'وزن الرول المتبقي لازم يكون رقم بالكجم' }, { status: 400 })
    if (remRollRaw > rollInputKg) return NextResponse.json({ error: `وزن الرول المتبقي (${remRollRaw}) مينفعش يزيد عن المسحوب (${rollInputKg})` }, { status: 400 })

    // ===== حساب الاستهلاك والهدر =====
    const coffeeConsumedKg = pullKg - remCoffeeRaw            // بن مستهلك فعلاً
    const coffeeInBagsKg = (actualBags * netCoffeePerBag) / 1000 // صافي البن اللي دخل الأكياس
    const coffeeWasteKg = Math.max(0, coffeeConsumedKg - coffeeInBagsKg)
    const rollConsumedKg = rollInputKg - remRollRaw           // رول مستهلك فعلاً
    const rollInBagsKg = (actualBags * pieceWeight) / 1000    // فيلم دخل الأكياس (وزن القطعة)
    const rollWasteKg = Math.max(0, rollConsumedKg - rollInBagsKg) // الباقي هدر — بيشمل كرتونة الرول (الفارغة)
    const wasteKg = coffeeWasteKg + rollWasteKg
    const wastePct = pullKg > 0 ? +((wasteKg / pullKg) * 100).toFixed(2) : 0

    const fallbackWh = await getDefaultWarehouseId()
    const finWh = await warehouseForStage(finProduct.stageId)

    await prisma.$transaction(async (tx) => {
      await tx.production.update({
        where: { id: production.id },
        data: {
          outputWeight: actualBags,
          wasteWeight: wasteKg,
          wastePercent: wastePct,
          actualUnits: Math.round(actualBags),
          actualTareWeight: null, // الفارغة (كرتونة الرول) هدر معروف من بنك الأصناف — مش قياس لكل قطعة
          rollRemainingKg: remRollRaw,
          coffeeRemainingKg: remCoffeeRaw,
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

      // إرجاع البن المتبقي لمخزن المطحون اللي اتسحب منه
      if (remCoffeeRaw > 0 && production.rawProductId) {
        const rawProd = await tx.product.findUnique({ where: { id: production.rawProductId } })
        if (rawProd) {
          const rawWh = rawProd.stageId ? await warehouseForStage(rawProd.stageId) : fallbackWh
          await tx.product.update({ where: { id: rawProd.id }, data: { quantity: { increment: remCoffeeRaw } } })
          await adjustStock(tx, rawWh, rawProd.id, remCoffeeRaw)
          await tx.warehouseIn.create({ data: { productId: rawProd.id, warehouseId: rawWh, quantity: remCoffeeRaw, source: `مرتجع بن متبقي — أمر ${production.orderNo}`, createdById: session.user.id } })
        }
      }

      // إرجاع الرول المتبقي لمخزن الرول اللي اتسحب منه
      if (remRollRaw > 0 && rollProduct) {
        const rollWh = rollProduct.stageId ? await warehouseForStage(rollProduct.stageId) : fallbackWh
        await tx.product.update({ where: { id: rollProduct.id }, data: { quantity: { increment: remRollRaw } } })
        await adjustStock(tx, rollWh, rollProduct.id, remRollRaw)
        await tx.warehouseIn.create({ data: { productId: rollProduct.id, warehouseId: rollWh, quantity: remRollRaw, source: `مرتجع رول متبقي — أمر ${production.orderNo}`, createdById: session.user.id } })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'إقفال تعبئة',
          description: `إقفال تشغيلة ${production.batchNo}: ${finProduct.name} — ${actualBags} عبوة`,
          impact: `+${actualBags} عبوة · هدر ${wasteKg.toFixed(2)} كجم (${wastePct}%)${remCoffeeRaw > 0 ? ` · رجّع ${remCoffeeRaw} كجم بن` : ''}${remRollRaw > 0 ? ` · رجّع ${remRollRaw} كجم رول` : ''}`,
        },
      })

      await flagWasteIfExceeded(tx, production.id, 'تعبئة', wastePct, {
        batchNo: production.batchNo || production.orderNo,
        userId: session.user.id,
        desc: `تعبئة ${finProduct.name} — ${actualBags} عبوة (هدر ${wasteKg.toFixed(2)} كجم)`,
      })
    })

    return NextResponse.json({
      success: true,
      actualBags,
      wasteKg: +wasteKg.toFixed(3),
      wastePct,
      coffeeConsumedKg: +coffeeConsumedKg.toFixed(3),
      coffeeInBagsKg: +coffeeInBagsKg.toFixed(3),
      rollConsumedKg: +rollConsumedKg.toFixed(3),
      returnedCoffeeKg: +remCoffeeRaw.toFixed(3),
      returnedRollKg: +remRollRaw.toFixed(3),
    })
  } catch {
    return NextResponse.json({ error: 'فشل إقفال تشغيلة التعبئة' }, { status: 500 })
  }
}
