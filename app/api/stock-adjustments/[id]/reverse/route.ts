import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock } from '@/lib/warehouse'
import { nextDocNo } from '@/lib/accounting'

// إلغاء الاعتماد والارتجاع (Rollback) — بقيد عكسي منظم وحركات مخزون عكسية · للأدمن فقط
export async function POST(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'إلغاء الاعتماد لمدير النظام فقط' }, { status: 403 })
  }

  try {
    const adj = await prisma.stockAdjustment.findUnique({
      where: { id: params.id },
      include: { items: true, journalEntry: { include: { lines: true } } },
    })
    if (!adj) return NextResponse.json({ error: 'مستند التسوية غير موجود' }, { status: 404 })
    if (adj.status !== 'POSTED') return NextResponse.json({ error: 'الارتجاع بيتم للمستندات المرحّلة بس' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      // عكس حركات المخزون
      const applicable = adj.items.filter((it) => it.countedQty != null && Number(it.varianceQty) !== 0)
      for (const it of applicable) {
        const reverseDelta = -Number(it.varianceQty)
        await tx.product.update({ where: { id: it.productId }, data: { quantity: { increment: reverseDelta } } })
        await adjustStock(tx, adj.warehouseId, it.productId, reverseDelta)
        if (reverseDelta < 0) {
          await tx.warehouseOut.create({ data: { productId: it.productId, warehouseId: adj.warehouseId, quantity: Math.abs(reverseDelta), target: 'إلغاء تسوية جرد', reason: `ارتجاع تسوية — ${adj.docNo}`, createdById: session.user.id } })
        } else {
          await tx.warehouseIn.create({ data: { productId: it.productId, warehouseId: adj.warehouseId, quantity: reverseDelta, source: `ارتجاع تسوية — ${adj.docNo}`, createdById: session.user.id } })
        }
      }

      // قيد عكسي (نفس السطور بعكس المدين/الدائن)
      if (adj.journalEntry) {
        const entryNo = await nextDocNo(tx, 'JV', 'journalEntry')
        await tx.journalEntry.create({
          data: {
            entryNo,
            description: `عكس قيد تسوية ${adj.docNo} (${adj.journalEntry.entryNo})`,
            sourceType: 'STOCK_ADJUSTMENT_REVERSAL',
            sourceId: adj.id,
            isReversal: true,
            createdById: session.user.id,
            lines: { create: adj.journalEntry.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.credit), credit: Number(l.debit), description: `عكس: ${l.description || ''}` })) },
          },
        })
      }

      await tx.stockAdjustment.update({ where: { id: adj.id }, data: { status: 'REVERSED' } })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'إلغاء اعتماد تسوية جرد',
          description: `ارتجاع تسوية ${adj.docNo} بقيد عكسي`,
          impact: `عكس صافي ${Number(adj.totalVarianceCost).toFixed(2)} ج.م والحركات المخزنية`,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل الارتجاع' }, { status: 500 })
  }
}
