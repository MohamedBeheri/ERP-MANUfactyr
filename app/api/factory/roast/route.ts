import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { ROAST_DEGREES, ensureRoastedVariant, nextBatchNo } from '@/lib/manufacturing'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// المرحلة ١ — بدء التحميص (خطوة أولى): العامل بيسجّل أنه هيحمّص كذا كجم بن أخضر بدرجة كذا،
// الأخضر يتخصم من المخزن فورًا، وتتفتح تشغيلة بحالة PENDING بدون ناتج/هدر لحد ما يرجع ويقفلها.
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const inputKg = Math.round(Number(b.inputKg))
    const degree = String(b.roastDegree || '')
    const channel = b.channel || 'المصنع'

    if (!b.greenProductId || !(inputKg > 0)) {
      return NextResponse.json({ error: 'اختار البن الأخضر واكتب وزن الداخل' }, { status: 400 })
    }
    if (!ROAST_DEGREES.includes(degree as any)) {
      return NextResponse.json({ error: `درجة التحميص لازم تكون: ${ROAST_DEGREES.join(' / ')}` }, { status: 400 })
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

    const production = await prisma.$transaction(async (tx) => {
      const roasted = await ensureRoastedVariant(tx, green, degree)
      const batchNo = await nextBatchNo(tx, 'TSH')

      const created = await tx.production.create({
        data: {
          orderNo: `RST-${Date.now()}`,
          lineType: 'ROASTING',
          stage: `تحميص ${degree} — ${green.name}`,
          batchNo,
          roastLevel: degree,
          inputWeight: inputKg,
          outputWeight: 0, // لسه ما اتقفلتش
          wasteWeight: 0,
          wastePercent: 0,
          channel,
          status: 'PENDING',
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          inputs: { create: [{ productId: green.id, quantity: inputKg, percentage: 100 }] },
          items: { create: [{ productId: roasted.id, quantity: 0 }] }, // placeholder — بيتحدث عند الإقفال
        },
        include: { items: { include: { product: true } } },
      })

      // خصم الأخضر من مخزن الخام فورًا (الماكينة اشتغلت)
      await tx.product.update({ where: { id: green.id }, data: { quantity: { decrement: inputKg } } })
      await adjustStock(tx, greenWh, green.id, -inputKg)

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'بدء تحميص',
          description: `تشغيلة ${batchNo}: بدء تحميص ${inputKg} كجم ${green.name} (${degree}) — ${channel}`,
          impact: `−${inputKg} كجم من مخزن الخام · بانتظار إقفال التشغيلة`,
        },
      })
      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل بدء التحميص' }, { status: 500 })
  }
}
