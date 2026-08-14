import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StockAdjustmentDoc } from '@/components/stock-adjustment-doc'

export const dynamic = 'force-dynamic'

export default async function AdjustmentDetail({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const params = await rawParams

  const adj = await prisma.stockAdjustment.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      journalEntry: { include: { lines: { include: { account: true } } } },
      items: { include: { product: { select: { name: true, unit: true, lotTracked: true } } }, orderBy: { product: { name: 'asc' } } },
    },
  })
  if (!adj) notFound()

  // الرصيد الدفتري اللحظي (لإظهار الحركات اللي حصلت بعد لقطة الجرد — التزامن)
  const liveStocks = await prisma.productStock.findMany({
    where: { warehouseId: adj.warehouseId, productId: { in: adj.items.map((it) => it.productId) } },
    select: { productId: true, quantity: true },
  })
  const liveMap = Object.fromEntries(liveStocks.map((s) => [s.productId, Number(s.quantity)]))

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/warehouse/adjustments" className="p-2 text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 rounded-lg" aria-label="رجوع"><ArrowRight className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">مستند تسوية الجرد</h1>
      </div>

      <StockAdjustmentDoc
        adj={{
          id: adj.id, docNo: adj.docNo, status: adj.status, adjustmentType: adj.adjustmentType, reasonCode: adj.reasonCode, stocktakeRef: adj.stocktakeRef,
          warehouseName: adj.warehouse.name, createdByName: adj.createdBy.name, approvedByName: adj.approvedBy?.name || null,
          postingDate: adj.postingDate?.toISOString() || null,
          shortageCost: Number(adj.shortageCost), surplusCost: Number(adj.surplusCost), totalVarianceCost: Number(adj.totalVarianceCost),
          journal: adj.journalEntry ? { entryNo: adj.journalEntry.entryNo, lines: adj.journalEntry.lines.map((l) => ({ account: l.account.name, debit: Number(l.debit), credit: Number(l.credit) })) } : null,
          items: adj.items.map((it) => ({ id: it.id, productName: it.product.name, unit: it.product.unit, lotTracked: it.product.lotTracked, snapshotQty: Number(it.snapshotQty), liveQty: liveMap[it.productId] ?? Number(it.snapshotQty), countedQty: it.countedQty != null ? Number(it.countedQty) : null, varianceQty: Number(it.varianceQty), unitCost: Number(it.unitCost), varianceCost: Number(it.varianceCost), action: it.action, batchNo: it.batchNo, expiryDate: it.expiryDate?.toISOString().slice(0, 10) || null, binLocation: it.binLocation })),
          isAdmin: session.user.role === 'ADMIN',
        }}
      />
    </div>
  )
}
