import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

interface Agg { name: string; qty: number; revenue: number; cost: number }

export default async function CategoriesReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [invItems, supplyItems] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: { invoice: { status: 'COMPLETED', createdAt: period } },
      select: { quantity: true, totalPrice: true, product: { select: { costPrice: true, category: { select: { name: true } } } } },
    }),
    prisma.keyAccountSupplyItem.findMany({
      where: { supply: { createdAt: period } },
      select: { quantity: true, totalPrice: true, product: { select: { costPrice: true, category: { select: { name: true } } } } },
    }),
  ])

  const map = new Map<string, Agg>()
  const add = (it: { quantity: number; totalPrice: unknown; product: { costPrice: unknown; category: { name: string } | null } }) => {
    const name = it.product.category?.name || 'بدون فئة'
    const cur = map.get(name) || { name, qty: 0, revenue: 0, cost: 0 }
    cur.qty += it.quantity
    cur.revenue += Number(it.totalPrice)
    cur.cost += it.quantity * Number(it.product.costPrice)
    map.set(name, cur)
  }
  invItems.forEach(add)
  supplyItems.forEach(add)

  const cats = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  const totRevenue = cats.reduce((s, c) => s + c.revenue, 0)
  const totCost = cats.reduce((s, c) => s + c.cost, 0)
  const totProfit = totRevenue - totCost

  const columns = [
    { header: 'الفئة' }, { header: 'كمية', align: 'end' as const }, { header: 'الإيراد', align: 'end' as const },
    { header: 'التكلفة', align: 'end' as const }, { header: 'الربح', align: 'end' as const },
    { header: 'الهامش', align: 'end' as const }, { header: 'من المبيعات', align: 'end' as const },
  ]
  const rows = cats.map((c) => {
    const profit = c.revenue - c.cost
    return [c.name, fmt(c.qty), money(c.revenue), money(c.cost),
      <span key="p" className={profit >= 0 ? 'font-bold text-green-600' : 'font-bold text-red-600'}>{money(profit)}</span>,
      `${pct(profit, c.revenue)}%`, `${pct(c.revenue, totRevenue)}%`]
  })
  const exportRows = cats.map((c) => [c.name, c.qty, c.revenue.toFixed(2), c.cost.toFixed(2), (c.revenue - c.cost).toFixed(2), `${pct(c.revenue - c.cost, c.revenue)}%`, `${pct(c.revenue, totRevenue)}%`])

  return (
    <ReportShell
      title="المبيعات حسب الفئة" subtitle="أداء كل فئة أصناف: إيراد وتكلفة وربح" basePath="/finance/categories"
      from={fromStr} to={toStr} exportName={`المبيعات-حسب-الفئة-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد الفئات', value: fmt(cats.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي الإيراد', value: money(totRevenue), color: 'text-green-600' },
        { label: 'إجمالي التكلفة', value: money(totCost), color: 'text-amber-600' },
        { label: 'إجمالي الربح', value: money(totProfit), color: totProfit >= 0 ? 'text-green-600' : 'text-red-600' },
      ]}
    >
      <ReportTable title="الفئات" columns={columns} rows={rows}
        footer={['الإجمالي', '', money(totRevenue), money(totCost), money(totProfit), `${pct(totProfit, totRevenue)}%`, '100%']} />
    </ReportShell>
  )
}
