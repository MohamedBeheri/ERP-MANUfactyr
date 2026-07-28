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

      // حساب العدد المتوقع
      const pullGrams = pullKg * 1000
      const tareWeight = Number(fin.packaging?.tareWeight || 0)
      const netPerBag = gramsPerPiece // وزن البن الصافي في الكيس
      const expectedBags = Math.floor(pullGrams / (netPerBag + tareWeight))

      const fallbackWh = await getDefaultWarehouseId()
      const sourceWh = source.stageId ? await warehouseForStage(source.stageId) : fallbackWh
      const sourceStock = await getStock(sourceWh, source.id)
      if (sourceStock < pullKg) {
        return NextResponse.json({ error: `رصيد "${source.name}" غير كافي (متاح ${sourceStock} كجم، مطلوب ${pullKg})` }, { status: 400 })
      }

      // تحقق رصيد التغليف (لو المنتج مربوط بمادة تغليف)
      let packaging = fin.packaging
      if (packaging) {
        const pkgWh = packaging.stageId ? await warehouseForStage(packaging.stageId) : fallbackWh
        const pkgStock = await getStock(pkgWh, packaging.id)
        if (pkgStock < expectedBags) {
          return NextResponse.json({ error: `رصيد التغليف "${packaging.name}" غير كافي (متاح ${pkgStock}، مطلوب ~${expectedBags})` }, { status: 400 })
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
            notes: b.notes?.trim() || null,
            createdById: session.user.id,
            inputs: {
              create: [
                { productId: source.id, quantity: pullKg, percentage: 100 },
                ...(packaging ? [{ productId: packaging.id, quantity: expectedBags, percentage: 0 }] : []),
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

        // خصم التغليف فوراً (بعدد الأكياس المتوقع)
        if (packaging) {
          const pkgWh = packaging.stageId ? await warehouseForStage(packaging.stageId) : fallbackWh
          await tx.product.update({ where: { id: packaging.id }, data: { quantity: { decrement: expectedBags } } })
          await adjustStock(tx, pkgWh, packaging.id, -expectedBags)
          await tx.warehouseOut.create({ data: { productId: packaging.id, warehouseId: pkgWh, quantity: expectedBags, target: 'تعبئة', reason: `أمر ${created.orderNo}`, createdById: session.user.id } })
        }

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'بدء تعبئة',
            description: `تشغيلة ${batchNo}: بدء تعبئة ${fin.name} — سحب ${pullKg} كجم من ${source.name} — متوقع ~${expectedBags} كيس`,
            impact: `−${pullKg} كجم مطحون${packaging ? ` · −${expectedBags} ${packaging.name}` : ''} · بانتظار إقفال التشغيلة`,
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
