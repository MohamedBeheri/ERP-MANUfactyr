import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock } from '@/lib/warehouse'
import { getGLAccounts, nextDocNo } from '@/lib/accounting'

// اعتماد وترحيل التسوية:
//  • تطبيق حركات المخزون التصحيحية (عجز = صرف · زيادة = إضافة)
//  • إنشاء قيد يومية آلي مجمّع (Compound JE) — عجز: مدين خسائر/دائن مخزون · زيادة: مدين مخزون/دائن أرباح
//  • قفل المستند نهائيًا (POSTED)
export async function POST(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth

  try {
    const adj = await prisma.stockAdjustment.findUnique({ where: { id: params.id }, include: { items: true } })
    if (!adj) return NextResponse.json({ error: 'مستند التسوية غير موجود' }, { status: 404 })
    if (adj.status !== 'REVIEWING') {
      return NextResponse.json({ error: 'لازم تخلّص العدّ وتراجع الفروق قبل الترحيل' }, { status: 400 })
    }
    const counted = adj.items.filter((it) => it.countedQty != null)
    if (counted.length === 0) return NextResponse.json({ error: 'مفيش أصناف اتعدّت — اكتب الكميات الفعلية الأول' }, { status: 400 })

    // احترام نوع التسوية
    const applicable = adj.items.filter((it) => {
      if (it.countedQty == null || Number(it.varianceQty) === 0) return false
      if (adj.adjustmentType === 'SHORTAGE_ONLY') return Number(it.varianceQty) < 0
      if (adj.adjustmentType === 'SURPLUS_ONLY') return Number(it.varianceQty) > 0
      return true
    })

    const shortageCost = applicable.filter((i) => Number(i.varianceQty) < 0).reduce((s, i) => s + Math.abs(Number(i.varianceCost)), 0)
    const surplusCost = applicable.filter((i) => Number(i.varianceQty) > 0).reduce((s, i) => s + Number(i.varianceCost), 0)

    const gl = await getGLAccounts()

    const result = await prisma.$transaction(async (tx) => {
      // 1) حركات المخزون التصحيحية
      for (const it of applicable) {
        const delta = Number(it.varianceQty) // موجب = زيادة · سالب = عجز
        await tx.product.update({ where: { id: it.productId }, data: { quantity: { increment: delta } } })
        await adjustStock(tx, adj.warehouseId, it.productId, delta)
        if (delta < 0) {
          await tx.warehouseOut.create({ data: { productId: it.productId, warehouseId: adj.warehouseId, quantity: Math.abs(delta), target: 'تسوية جرد', reason: `عجز جرد — ${adj.docNo}`, createdById: session.user.id } })
        } else {
          await tx.warehouseIn.create({ data: { productId: it.productId, warehouseId: adj.warehouseId, quantity: delta, source: `زيادة جرد — ${adj.docNo}`, createdById: session.user.id } })
        }
      }

      // 2) قيد يومية آلي مجمّع
      const entryNo = await nextDocNo(tx, 'JV', 'journalEntry')
      const lines: { accountId: string; debit: number; credit: number; description: string }[] = []
      if (shortageCost > 0) {
        lines.push({ accountId: gl.loss.id, debit: shortageCost, credit: 0, description: 'عجز تسوية مخزون' })
        lines.push({ accountId: gl.inventory.id, debit: 0, credit: shortageCost, description: 'تخفيض مخزون بالعجز' })
      }
      if (surplusCost > 0) {
        lines.push({ accountId: gl.inventory.id, debit: surplusCost, credit: 0, description: 'زيادة مخزون بالتسوية' })
        lines.push({ accountId: gl.gain.id, debit: 0, credit: surplusCost, description: 'أرباح تسوية مخزون' })
      }
      let journalEntryId: string | null = null
      if (lines.length > 0) {
        const je = await tx.journalEntry.create({
          data: {
            entryNo,
            description: `تسوية جرد ${adj.docNo} — مخزن ${adj.warehouseId}`,
            sourceType: 'STOCK_ADJUSTMENT',
            sourceId: adj.id,
            createdById: session.user.id,
            lines: { create: lines },
          },
        })
        journalEntryId = je.id
      }

      // 3) قفل المستند
      const posted = await tx.stockAdjustment.update({
        where: { id: adj.id },
        data: {
          status: 'POSTED',
          postingDate: new Date(),
          approvedById: session.user.id,
          journalEntryId,
          shortageCost,
          surplusCost,
          totalVarianceCost: +(surplusCost - shortageCost).toFixed(2),
        },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'اعتماد وترحيل تسوية جرد',
          description: `ترحيل تسوية ${adj.docNo} (${applicable.length} صنف)`,
          impact: `عجز ${shortageCost.toFixed(2)} · زيادة ${surplusCost.toFixed(2)} · صافي ${(surplusCost - shortageCost).toFixed(2)} ج.م`,
        },
      })
      return posted
    })

    return NextResponse.json({ success: true, shortageCost, surplusCost, adjustment: result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل ترحيل التسوية' }, { status: 500 })
  }
}
