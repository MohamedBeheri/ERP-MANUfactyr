import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { ROAST_DEGREES, ensureRoastedVariant, nextBatchNo, flagWasteIfExceeded } from '@/lib/manufacturing'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// المرحلة ١ — التحميص: بن أخضر (مورد/نوع/كمية) ← بن محمص بدرجة، برقم تشغيلة مستقل وهدر محسوب.
// المدخل: greenProductId + roastDegree + inputKg (الأخضر الداخل) + outputKg (الموزون بعد التحميص).
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const inputKg = Math.round(Number(b.inputKg))
    const outputKg = Math.round(Number(b.outputKg))
    const degree = String(b.roastDegree || '')
    const channel = b.channel || 'المصنع'

    if (!b.greenProductId || !(inputKg > 0) || !(outputKg > 0)) {
      return NextResponse.json({ error: 'اختار البن الأخضر واكتب وزن الداخل والخارج' }, { status: 400 })
    }
    if (!ROAST_DEGREES.includes(degree as any)) {
      return NextResponse.json({ error: `درجة التحميص لازم تكون: ${ROAST_DEGREES.join(' / ')}` }, { status: 400 })
    }
    if (outputKg > inputKg) {
      return NextResponse.json({ error: 'وزن الخارج من التحميص مينفعش يزيد عن الداخل' }, { status: 400 })
    }

    const green = await prisma.product.findUnique({ where: { id: b.greenProductId } })
    if (!green || green.itemKind !== 'GREEN') {
      return NextResponse.json({ error: 'الصنف المختار مش بن أخضر' }, { status: 400 })
    }

    const greenWh = await warehouseForStage(green.stageId)
    const stock = await getStock(greenWh, green.id)
    if (stock < inputKg) {
      return NextResponse.json({ error: `رصيد ${green.name} غير كافي (المتاح: ${stock} كجم)` }, { status: 400 })
    }

    const wasteKg = inputKg - outputKg
    const wastePct = +((wasteKg / inputKg) * 100).toFixed(2)

    const production = await prisma.$transaction(async (tx) => {
      const roasted = await ensureRoastedVariant(tx, green, degree)
      const roastedWh = await warehouseForStage(roasted.stageId)
      const batchNo = await nextBatchNo(tx, 'TSH')

      const created = await tx.production.create({
        data: {
          orderNo: `RST-${Date.now()}`,
          lineType: 'ROASTING',
          stage: `تحميص ${degree} — ${green.name}`,
          batchNo,
          roastLevel: degree,
          inputWeight: inputKg,
          outputWeight: outputKg,
          wasteWeight: wasteKg,
          wastePercent: wastePct,
          channel,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          inputs: { create: [{ productId: green.id, quantity: inputKg, percentage: 100 }] },
          items: { create: [{ productId: roasted.id, quantity: outputKg }] },
        },
        include: { items: { include: { product: true } } },
      })

      // خصم الأخضر من مخزن الخام + إضافة المحمص لمخزن التحميص
      await tx.product.update({ where: { id: green.id }, data: { quantity: { decrement: inputKg } } })
      await adjustStock(tx, greenWh, green.id, -inputKg)
      await tx.product.update({ where: { id: roasted.id }, data: { quantity: { increment: outputKg } } })
      await adjustStock(tx, roastedWh, roasted.id, outputKg)

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تحميص',
          description: `تشغيلة ${batchNo}: تحميص ${inputKg} كجم ${green.name} (${degree}) — ${channel}`,
          impact: `خرج ${outputKg} كجم محمص · هدر ${wasteKg} كجم (${wastePct}%)`,
        },
      })

      // فحص حد الهدر المسموح للتحميص — لو اتعدّى: تعليم التشغيلة + إشعار للأدمن
      await flagWasteIfExceeded(tx, created.id, 'تحميص', wastePct, {
        batchNo,
        userId: session.user.id,
        desc: `تحميص ${green.name} (${degree}) — دخل ${inputKg} خرج ${outputKg} كجم`,
      })
      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تسجيل التحميص' }, { status: 500 })
  }
}
