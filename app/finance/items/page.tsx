import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

interface Agg { name: string; unit: string; qty: number; revenue: number; cost: number }

export default async function ItemsReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [invItems, supplyItems] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: { invoice: { status: 'COMPLETED', createdAt: period } },
      select: { productId: true, quantity: true, totalPrice: true, product: { select: { name: true, unit: true, costPrice: true } } },
    }),
    prisma.keyAccountSupplyItem.findMany({
      where: { supply: { createdAt: period } },
      select: { productId: true, quantity: true, totalPrice: true, product: { select: { name: true, unit: true, costPrice: true } } },
    }),
  ])

  const map = new Map<string, Agg>()
  const add = (it: { productId: string; quantity: number; totalPrice: unknown; product: { name: string; unit: string; costPrice: unknown } }) => {
    const cur = map.get(it.productId) || { name: it.product.name, unit: it.product.unit, qty: 0, revenue: 0, cost: 0 }
    cur.qty += it.quantity
    cur.revenue += Number(it.totalPrice)
    cur.cost += it.quantity * Number(it.product.costPrice)
    map.set(it.productId, cur)
  }
  invItems.forEach(add)
  supplyItems.forEach(add)

  const items = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  const totRevenue = items.reduce((s, i) => s + i.revenue, 0)
  const totCost = items.reduce((s, i) => s + i.cost, 0)
  const totQty = items.reduce((s, i) => s + i.qty, 0)
  const totProfit = totRevenue - totCost

  const columns = [
    { header: 'الصنف' }, { header: 'الكمية المباعة', align: 'end' as const }, { header: 'الإيراد', align: 'end' as const },
    { header: 'التكلفة', align: 'end' as const }, { header: 'الربح', align: 'end' as const }, { header: 'الهامش', align: 'end' as const },
  ]
  const rows = items.map((i) => {
    const profit = i.revenue - i.cost
    return [
      i.name, `${fmt(i.qty)} ${i.unit}`, money(i.revenue), money(i.cost),
      <span key="p" className={profit >= 0 ? 'font-bold text-green-600' : 'font-bold text-red-600'}>{money(profit)}</span>,
      `${pct(profit, i.revenue)}%`,
    ]
  })
  const exportRows = items.map((i) => [i.name, i.qty, i.revenue.toFixed(2), i.cost.toFixed(2), (i.revenue - i.cost).toFixed(2), `${pct(i.revenue - i.cost, i.revenue)}%`])

  return (
    <ReportShell
      title="تقرير الأصناف" subtitle="الكمية المباعة والإيراد والتكلفة والربح لكل صنف" basePath="/finance/items"
      from={fromStr} to={toStr} exportName={`تقرير-الأصناف-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'أصناف مباعة', value: fmt(items.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي الإيراد', value: money(totRevenue), color: 'text-green-600' },
        { label: 'إجمالي التكلفة', value: money(totCost), color: 'text-amber-600' },
        { label: 'إجمالي الربح', value: money(totProfit), color: totProfit >= 0 ? 'text-green-600' : 'text-red-600' },
      ]}
    >
      <ReportTable title="الأصناف الأكثر مبيعًا" columns={columns} rows={rows}
        footer={['الإجمالي', fmt(totQty), money(totRevenue), money(totCost), money(totProfit), `${pct(totProfit, totRevenue)}%`]} />
    </ReportShell>
  )
}
