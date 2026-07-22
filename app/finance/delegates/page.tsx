import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function DelegatesReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const delegates = await prisma.delegate.findMany({
    where: { isActive: true },
    include: {
      vehicle: { select: { plateNo: true } },
      settlements: { where: { createdAt: period }, select: { soldQty: true, bonusQty: true, returnedQty: true, cashAmount: true, creditAmount: true, commission: true } },
      _count: { select: { invoices: { where: { status: 'COMPLETED', createdAt: period } } } },
    },
    orderBy: { name: 'asc' },
  })

  const stat = delegates.map((d) => {
    const sold = d.settlements.reduce((s, x) => s + x.soldQty, 0)
    const bonus = d.settlements.reduce((s, x) => s + x.bonusQty, 0)
    const returned = d.settlements.reduce((s, x) => s + x.returnedQty, 0)
    const cash = d.settlements.reduce((s, x) => s + Number(x.cashAmount), 0)
    const credit = d.settlements.reduce((s, x) => s + Number(x.creditAmount), 0)
    const commission = d.settlements.reduce((s, x) => s + Number(x.commission), 0)
    return { name: d.name, plate: d.vehicle?.plateNo || d.carNumber || '—', rounds: d.settlements.length, invoices: d._count.invoices, sold, bonus, returned, cash, credit, commission }
  })

  const T = stat.reduce((a, s) => ({ cash: a.cash + s.cash, credit: a.credit + s.credit, commission: a.commission + s.commission, sold: a.sold + s.sold }), { cash: 0, credit: 0, commission: 0, sold: 0 })

  const columns = [
    { header: 'المندوب' }, { header: 'العربية', align: 'center' as const }, { header: 'جولات', align: 'center' as const },
    { header: 'فواتير', align: 'center' as const }, { header: 'مباع', align: 'end' as const }, { header: 'هدايا', align: 'end' as const },
    { header: 'مرتجع', align: 'end' as const }, { header: 'نقدي', align: 'end' as const }, { header: 'آجل', align: 'end' as const }, { header: 'عمولة', align: 'end' as const },
  ]
  const rows = stat.map((s) => [
    s.name, s.plate, fmt(s.rounds), fmt(s.invoices), fmt(s.sold), fmt(s.bonus), fmt(s.returned),
    money(s.cash), money(s.credit), <span key="c" className="font-bold text-[#e94560]">{money(s.commission)}</span>,
  ])
  const exportRows = stat.map((s) => [s.name, s.plate, s.rounds, s.invoices, s.sold, s.bonus, s.returned, s.cash.toFixed(2), s.credit.toFixed(2), s.commission.toFixed(2)])

  return (
    <ReportShell
      title="أداء المناديب" subtitle="مبيعات وتحصيل وعمولات كل مندوب خلال الفترة" basePath="/finance/delegates"
      from={fromStr} to={toStr} exportName={`أداء-المناديب-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد المناديب', value: fmt(stat.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي المحصّل نقدي', value: money(T.cash), color: 'text-emerald-600' },
        { label: 'إجمالي الآجل', value: money(T.credit), color: 'text-amber-600' },
        { label: 'إجمالي العمولات', value: money(T.commission), color: 'text-[#e94560]' },
      ]}
    >
      <ReportTable title="المناديب" columns={columns} rows={rows}
        footer={['الإجمالي', '', '', '', fmt(T.sold), '', '', money(T.cash), money(T.credit), money(T.commission)]} />
    </ReportShell>
  )
}
