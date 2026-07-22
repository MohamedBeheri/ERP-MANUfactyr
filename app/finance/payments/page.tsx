import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function PaymentsReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const grouped = await prisma.invoice.groupBy({
    by: ['paymentMethod'],
    where: { status: 'COMPLETED', createdAt: period },
    _sum: { netAmount: true, paidAmount: true },
    _count: true,
  })

  const total = grouped.reduce((s, g) => s + (Number(g._sum.netAmount) || 0), 0)
  const rowsData = grouped.map((g) => ({ method: g.paymentMethod, count: g._count, net: Number(g._sum.netAmount) || 0, paid: Number(g._sum.paidAmount) || 0 }))
    .sort((a, b) => b.net - a.net)

  const columns = [
    { header: 'طريقة الدفع' }, { header: 'عدد الفواتير', align: 'center' as const },
    { header: 'إجمالي القيمة', align: 'end' as const }, { header: 'المحصّل', align: 'end' as const }, { header: 'النسبة', align: 'end' as const },
  ]
  const rows = rowsData.map((r) => [
    <span key="m" className="font-semibold">{r.method}</span>, fmt(r.count),
    <span key="n" className="font-bold">{money(r.net)}</span>, money(r.paid), `${pct(r.net, total)}%`,
  ])
  const exportRows = rowsData.map((r) => [r.method, r.count, r.net.toFixed(2), r.paid.toFixed(2), `${pct(r.net, total)}%`])

  return (
    <ReportShell
      title="طرق الدفع" subtitle="توزيع المبيعات على طرق الدفع المختلفة" basePath="/finance/payments"
      from={fromStr} to={toStr} exportName={`طرق-الدفع-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد الطرق', value: fmt(rowsData.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي المبيعات', value: money(total), color: 'text-green-600' },
        { label: 'أكثر طريقة', value: rowsData[0]?.method || '—', color: 'text-[#0f3460]' },
        { label: 'إجمالي المحصّل', value: money(rowsData.reduce((s, r) => s + r.paid, 0)), color: 'text-emerald-600' },
      ]}
    >
      <ReportTable title="الطرق" columns={columns} rows={rows}
        footer={['الإجمالي', fmt(rowsData.reduce((s, r) => s + r.count, 0)), money(total), money(rowsData.reduce((s, r) => s + r.paid, 0)), '100%']} />
    </ReportShell>
  )
}
