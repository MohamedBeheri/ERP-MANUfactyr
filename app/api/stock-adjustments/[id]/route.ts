import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

// تفاصيل مستند التسوية
export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const adj = await prisma.stockAdjustment.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      journalEntry: { include: { lines: { include: { account: true } } } },
      items: { include: { product: { select: { name: true, unit: true } } }, orderBy: { product: { name: 'asc' } } },
    },
  })
  if (!adj) return NextResponse.json({ error: 'مستند التسوية غير موجود' }, { status: 404 })
  return NextResponse.json(adj)
}

// حفظ الكميات المعدودة — بيحسب الفرق وقيمته ونوع الحركة، وينقل الحالة لمراجعة الفروق
export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    const adj = await prisma.stockAdjustment.findUnique({ where: { id: params.id }, include: { items: true } })
    if (!adj) return NextResponse.json({ error: 'مستند التسوية غير موجود' }, { status: 404 })
    if (!['IN_PROGRESS', 'REVIEWING'].includes(adj.status)) {
      return NextResponse.json({ error: 'المستند مقفول — مينفعش تعدّل العدّ بعد الترحيل' }, { status: 400 })
    }

    const parsed = await getCounts(req)
    let totalShort = 0, totalSurplus = 0

    await prisma.$transaction(async (tx) => {
      for (const it of adj.items) {
        const countedRaw = parsed[it.id]
        const counted = countedRaw === undefined ? (it.countedQty != null ? Number(it.countedQty) : null) : countedRaw
        if (counted === null) {
          await tx.stockAdjustmentItem.update({ where: { id: it.id }, data: { countedQty: null, varianceQty: 0, varianceCost: 0, action: 'MATCHED' } })
          continue
        }
        const variance = +(counted - Number(it.snapshotQty)).toFixed(3)
        const cost = +(Math.abs(variance) * Number(it.unitCost)).toFixed(2)
        const action = variance < 0 ? 'SHORTAGE' : variance > 0 ? 'SURPLUS' : 'MATCHED'
        if (action === 'SHORTAGE') totalShort += cost
        if (action === 'SURPLUS') totalSurplus += cost
        await tx.stockAdjustmentItem.update({
          where: { id: it.id },
          data: { countedQty: counted, varianceQty: variance, varianceCost: variance < 0 ? -cost : cost, action },
        })
      }
      await tx.stockAdjustment.update({
        where: { id: adj.id },
        data: { status: 'REVIEWING', shortageCost: totalShort, surplusCost: totalSurplus, totalVarianceCost: +(totalSurplus - totalShort).toFixed(2) },
      })
    })

    return NextResponse.json({ success: true, shortageCost: totalShort, surplusCost: totalSurplus })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل حفظ العدّ' }, { status: 500 })
  }
}

async function getCounts(req: NextRequest): Promise<Record<string, number>> {
  const b = await req.json()
  const out: Record<string, number> = {}
  if (Array.isArray(b.counts)) {
    for (const c of b.counts) {
      if (c?.itemId != null && c.countedQty !== '' && c.countedQty !== null && c.countedQty !== undefined && isFinite(Number(c.countedQty))) {
        out[String(c.itemId)] = Number(c.countedQty)
      }
    }
  }
  return out
}
