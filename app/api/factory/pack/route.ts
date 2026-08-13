import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock, getStock, getDefaultWarehouseId } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { nextBatchNo } from '@/lib/manufacturing'


// التعبئة والتغليف — تدفق جديد (PENDING ← COMPLETED):
// ١. سحب كمية من المطحون (sourceProductId + pullKg)
// ٢. اختيار المنتج النهائي من القائمة (finishedId) — فيه وزن الكيس وبيانات التغليف
// ٣. فتح تشغيلة PENDING — المدخلات بتتخصم فوراً
// ٤. بعد ما خط التعبئة يخلص، العامل يقفل التشغيلة بعدد الأكياس الفعلي → النظام يحسب الهدر أوتو
export async function POST(req: NextRequest) {
  const auth = await requirePermission('factory', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()

    // ===== التدفق الجديد: source + finished + pull → PENDING =====
    if (b.sourceProductId && b.finishedId && b.pullKg) {
      const pullKg = Number(b.pullKg) || 0
      const channel = b.channel || 'المصنع'

      if (pullKg <= 0) return NextResponse.json({ error: 'اكتب الكمية المسحوبة من المطحون' }, { status: 400 })

      const source = await prisma.product.findUnique({ where: { id: b.sourceProductId } })
      if (!source || source.itemKind !== 'BLEND') {
        return NextResponse.json({ error: 'المنتج المصدر غير موجود أو مش من المطحون' }, { status: 400 })
      }

      const fin = await prisma.product.findUnique({
        where: { id: b.finishedId },
        include: { packaging: true },
      })
      if (!fin || fin.itemKind !== 'FINISHED') {
        return NextResponse.json({ error: 'المنتج النهائي غير صحيح' }, { status: 400 })
      }

      const gramsPerPiece = Number(fin.gramsPerPiece) || 0
      if (gramsPerPiece <= 0) {
        return NextResponse.json({ error: `المنتج "${fin.name}" مفيهوش وزن كيس محدد — عدّله في بنك الأصناف` }, { status: 400 })
      }

      const fallbackWh = await getDefaultWarehouseId()
      const sourceWh = source.stageId ? await warehouseForStage(source.stageId) : fallbackWh
      const sourceStock = await getStock(sourceWh, source.id)
      if (sourceStock < pullKg) {
        return NextResponse.json({ error: `رصيد "${source.name}" غير كافي (متاح ${sourceStock} كجم، مطلوب ${pullKg})` }, { status: 400 })
      }

      // ===== الرول (مادة التغليف) — بيتسحب بالوزن كجم =====
      // الرول اختياري: لو المنتج مربوط بتغليف بنستخدمه افتراضياً، والمشغّل يقدر يختار رول تاني ويحدد كمية بالكجم
      let roll = fin.packaging
      if (b.rollProductId && b.rollProductId !== roll?.id) {
        roll = await prisma.product.findUnique({ where: { id: b.rollProductId } })
        if (!roll || roll.itemKind !== 'PACKAGING') {
          return NextResponse.json({ error: 'الرول/مادة التغليف المختارة غير صحيحة' }, { status: 400 })
        }
      }
      const rollPullKg = Number(b.rollPullKg) || 0
      const rollTare = Number(roll?.tareWeight || 0) // وزن الوحدة (الكيس الفارغ) بالجرام
      // عدد الأكياس المتوقّع من الرول = وزن الرول بالكجم ÷ وزن الوحدة الواحدة
      const bagsFromRoll = roll && rollPullKg > 0 && rollTare > 0 ? Math.floor((rollPullKg * 1000) / rollTare) : 0
      // عدد الأكياس المتوقّع من البن = كمية البن ÷ وزن الكيس الصافي
      const bagsFromCoffee = Math.floor((pullKg * 1000) / gramsPerPiece)
      const expectedBags = roll && rollPullKg > 0 ? Math.min(bagsFromCoffee, bagsFromRoll) : bagsFromCoffee

      // تحقق رصيد الرول (بالكجم) لو المشغّل حدّد كمية رول
      if (roll && rollPullKg > 0) {
        const rollWh = roll.stageId ? await warehouseForStage(roll.stageId) : fallbackWh
        const rollStock = await getStock(rollWh, roll.id)
        if (rollStock < rollPullKg) {
          return NextResponse.json({ error: `رصيد الرول "${roll.name}" غير كافي (متاح ${rollStock} كجم، مطلوب ${rollPullKg})` }, { status: 400 })
        }
      }

      const production = await prisma.$transaction(async (tx) => {
        const batchNo = await nextBatchNo(tx, 'PACK')

        const created = await tx.production.create({
          data: {
            orderNo: `PACK-${Date.now()}`,
            lineType: 'PROCESSING',
            stage: `تعبئة — ${fin.name}`,
            batchNo,
            channel,
            inputWeight: pullKg,
            outputWeight: 0,
            wasteWeight: 0,
            wastePercent: 0,
            status: 'PENDING',
            rawProductId: source.id,
            rawUsed: pullKg,
            rollProductId: roll && rollPullKg > 0 ? roll.id : null,
            rollInputKg: roll && rollPullKg > 0 ? rollPullKg : null,
            notes: b.notes?.trim() || null,
            createdById: session.user.id,
            inputs: {
              create: [
                { productId: source.id, quantity: pullKg, percentage: 100 },
                ...(roll && rollPullKg > 0 ? [{ productId: roll.id, quantity: rollPullKg, percentage: 0 }] : []),
              ],
            },
            items: { create: [{ productId: fin.id, quantity: 0 }] },
          },
          include: { items: { include: { product: true } } },
        })

        // خصم المطحون فوراً
        await tx.product.update({ where: { id: source.id }, data: { quantity: { decrement: pullKg } } })
        await adjustStock(tx, sourceWh, source.id, -pullKg)
        await tx.warehouseOut.create({ data: { productId: source.id, warehouseId: sourceWh, quantity: pullKg, target: 'تعبئة', reason: `أمر ${created.orderNo}`, createdById: session.user.id } })

        // خصم الرول فوراً (بالكجم)
        if (roll && rollPullKg > 0) {
          const rollWh = roll.stageId ? await warehouseForStage(roll.stageId) : fallbackWh
          await tx.product.update({ where: { id: roll.id }, data: { quantity: { decrement: rollPullKg } } })
          await adjustStock(tx, rollWh, roll.id, -rollPullKg)
          await tx.warehouseOut.create({ data: { productId: roll.id, warehouseId: rollWh, quantity: rollPullKg, target: 'تعبئة', reason: `أمر ${created.orderNo}`, createdById: session.user.id } })
        }

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'بدء تعبئة',
            description: `تشغيلة ${batchNo}: بدء تعبئة ${fin.name} — سحب ${pullKg} كجم بن${roll && rollPullKg > 0 ? ` + ${rollPullKg} كجم رول (${roll.name})` : ''} — متوقع ~${expectedBags} كيس`,
            impact: `−${pullKg} كجم مطحون${roll && rollPullKg > 0 ? ` · −${rollPullKg} كجم رول ${roll.name}` : ''} · بانتظار إقفال التشغيلة`,
          },
        })
        return created
      })

      return NextResponse.json(production, { status: 201 })
    }

    return NextResponse.json({ error: 'بيانات ناقصة — اختار المنتج المطحون والمنتج النهائي والكمية' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'فشل بدء التعبئة' }, { status: 500 })
  }
}
