import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function CustomersReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    include: {
      tier: { select: { name: true } },
      invoices: { where: { status: 'COMPLETED', createdAt: period }, select: { netAmount: true } },
    },
    orderBy: { totalPurchases: 'desc' },
  })

  const stat = customers.map((c) => ({
    name: c.name,
    type: c.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي',
    tier: c.tier?.name || '—',
    periodSales: c.invoices.reduce((s, i) => s + Number(i.netAmount), 0),
    total: Number(c.totalPurchases),
    balance: Number(c.balance),
    points: Number(c.bonusPoints),
  }))

  const periodTotal = stat.reduce((s, c) => s + c.periodSales, 0)
  const totalDebt = stat.reduce((s, c) => s + c.balance, 0)
  const totalPoints = stat.reduce((s, c) => s + c.points, 0)

  const columns = [
    { header: 'العميل' }, { header: 'النوع', align: 'center' as const }, { header: 'الفئة', align: 'center' as const },
    { header: 'مبيعات الفترة', align: 'end' as const }, { header: 'إجمالي المشتريات', align: 'end' as const },
    { header: 'الرصيد المدين', align: 'end' as const }, { header: 'نقاط البونص', align: 'end' as const },
  ]
  const rows = stat.map((c) => [
    <span key="n" className="font-semibold">{c.name}</span>,
    <span key="t" className={`px-2 py-0.5 rounded text-xs font-semibold ${c.type === 'جملة' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>{c.type}</span>,
    c.tier, money(c.periodSales), money(c.total),
    <span key="b" className={c.balance > 0 ? 'font-bold text-amber-600' : 'text-gray-400'}>{money(c.balance)}</span>,
    fmt(c.points),
  ])
  const exportRows = stat.map((c) => [c.name, c.type, c.tier, c.periodSales.toFixed(2), c.total.toFixed(2), c.balance.toFixed(2), c.points.toFixed(2)])

  return (
    <ReportShell
      title="كشف العملاء" subtitle="مبيعات الفترة وإجمالي المشتريات والأرصدة ونقاط الولاء لكل عميل" basePath="/finance/customers"
      from={fromStr} to={toStr} exportName={`كشف-العملاء-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد العملاء', value: fmt(stat.length), color: 'text-[#0f3460]' },
        { label: 'مبيعات الفترة', value: money(periodTotal), color: 'text-green-600' },
        { label: 'إجمالي ديون العملاء', value: money(totalDebt), color: 'text-amber-600' },
        { label: 'رصيد نقاط الولاء', value: fmt(totalPoints), color: 'text-purple-600' },
      ]}
    >
      <ReportTable title="العملاء" columns={columns} rows={rows}
        footer={['الإجمالي', '', '', money(periodTotal), '', money(totalDebt), fmt(totalPoints)]} />
    </ReportShell>
  )
}
