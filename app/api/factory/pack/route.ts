import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock, getDefaultWarehouseId } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// تعبئة: منتج نهائي × عدد علب → يخصم التوليفة (بن مطحون) والتغليف، وينتج المنتج النهائي.
// البن المستهلك (كجم) = (وزن القطعة − وزن الفارغ) × قطع/علبة × عدد العلب ÷ 1000.
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const boxes = Math.round(Number(b.boxes) || 0)
    if (!b.finishedId || boxes <= 0) return NextResponse.json({ error: 'اختار المنتج وعدد العلب' }, { status: 400 })

    const fin = await prisma.product.findUnique({
      where: { id: b.finishedId },
      include: { blend: true, packaging: true },
    })
    if (!fin || fin.itemKind !== 'FINISHED') return NextResponse.json({ error: 'المنتج النهائي غير صحيح' }, { status: 400 })
    if (!fin.blend) return NextResponse.json({ error: 'المنتج ده مش مربوط بتوليفة — عرّفها في بنك الأصناف' }, { status: 400 })

    const pieces = fin.piecesPerBox * boxes
    const netGram = Math.max(0, Number(fin.gramsPerPiece) - Number(fin.packaging?.tareWeight || 0))
    const coffeeKg = Math.round((netGram * pieces) / 1000)
    if (coffeeKg <= 0) return NextResponse.json({ error: 'راجع وزن القطعة ووزن الفارغ للمنتج' }, { status: 400 })

    // تحقّق التعبئة: الصافي الفعلي مقابل النظري (كشف العجز/الغلط البشري)
    const wasteKg = Math.max(0, Math.round(Number(b.wasteKg) || 0))
    const actualCoffeeKg = Number(b.actualCoffeeKg) || 0
    const tareKg = (pieces * Number(fin.packaging?.tareWeight || 0)) / 1000
    const netUsed = actualCoffeeKg > 0 ? actualCoffeeKg - tareKg - wasteKg : null
    const variance = netUsed !== null ? netUsed - coffeeKg : null
    const varianceNote =
      netUsed !== null && variance !== null
        ? ` | تحقّق: صافي فعلي ${netUsed.toFixed(2)} مقابل نظري ${coffeeKg} (${variance >= 0 ? 'زيادة' : 'عجز'} ${Math.abs(variance).toFixed(2)} كجم)`
        : ''

    const fallbackWh = b.warehouseId || (await getDefaultWarehouseId())
    const blendWh = fin.blend.stageId ? await warehouseForStage(fin.blend.stageId) : fallbackWh
    const finWh = fin.stageId ? await warehouseForStage(fin.stageId) : fallbackWh

    // تحقق رصيد التوليفة
    const blendStock = await getStock(blendWh, fin.blend.id)
    if (blendStock < coffeeKg) return NextResponse.json({ error: `رصيد التوليفة ${fin.blend.name} غير كافي (متاح ${blendStock} كجم، مطلوب ${coffeeKg})` }, { status: 400 })
    // تحقق رصيد التغليف (اختياري)
    if (fin.packaging) {
      const pkgWh = fin.packaging.stageId ? await warehouseForStage(fin.packaging.stageId) : fallbackWh
      const pkgStock = await getStock(pkgWh, fin.packaging.id)
      if (pkgStock < pieces) return NextResponse.json({ error: `رصيد التغليف ${fin.packaging.name} غير كافي (متاح ${pkgStock}، مطلوب ${pieces})` }, { status: 400 })
    }

    const production = await prisma.$transaction(async (tx) => {
      const created = await tx.production.create({
        data: {
          orderNo: `PACK-${Date.now()}`,
          lineType: 'PROCESSING',
          stage: `تعبئة — ${fin.name}`,
          batchNo: b.batchNo || null,
          channel: b.channel || 'المصنع',
          expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
          inputWeight: coffeeKg,
          outputWeight: boxes,
          wasteWeight: wasteKg,
          wastePercent: coffeeKg > 0 ? (wasteKg / coffeeKg) * 100 : 0,
          rawProductId: fin.blend!.id,
          rawUsed: coffeeKg,
          notes: `${b.notes || ''}${varianceNote}`.trim() || null,
          createdById: session.user.id,
          inputs: {
            create: [
              { productId: fin.blend!.id, quantity: coffeeKg, percentage: 100 },
              ...(fin.packaging ? [{ productId: fin.packaging.id, quantity: pieces, percentage: 0 }] : []),
            ],
          },
          items: { create: [{ productId: fin.id, quantity: boxes }] },
        },
      })

      // خصم التوليفة
      await tx.product.update({ where: { id: fin.blend!.id }, data: { quantity: { decrement: coffeeKg } } })
      await adjustStock(tx, blendWh, fin.blend!.id, -coffeeKg)
      await tx.warehouseOut.create({ data: { productId: fin.blend!.id, warehouseId: blendWh, quantity: coffeeKg, target: 'تعبئة', reason: `أمر ${created.orderNo}`, createdById: session.user.id } })

      // خصم التغليف
      if (fin.packaging) {
        const pkgWh = fin.packaging.stageId ? await warehouseForStage(fin.packaging.stageId) : fallbackWh
        await tx.product.update({ where: { id: fin.packaging.id }, data: { quantity: { decrement: pieces } } })
        await adjustStock(tx, pkgWh, fin.packaging.id, -pieces)
        await tx.warehouseOut.create({ data: { productId: fin.packaging.id, warehouseId: pkgWh, quantity: pieces, target: 'تعبئة', reason: `أمر ${created.orderNo}`, createdById: session.user.id } })
      }

      // إنتاج المنتج النهائي
      await tx.product.update({ where: { id: fin.id }, data: { quantity: { increment: boxes } } })
      await adjustStock(tx, finWh, fin.id, boxes)
      await tx.warehouseIn.create({ data: { productId: fin.id, warehouseId: finWh, quantity: boxes, source: `تعبئة — أمر ${created.orderNo}`, createdById: session.user.id } })

      await tx.auditLog.create({ data: { userId: session.user.id, action: 'تعبئة', description: `${created.orderNo} — ${fin.name} ${boxes} علبة`, impact: `توليفة ${coffeeKg} كجم + تغليف ${pieces}` } })
      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل التعبئة' }, { status: 500 })
  }
}
