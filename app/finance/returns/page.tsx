import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod, dateShort } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function ReturnsReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const returns = await prisma.deliveryReturn.findMany({
    where: { createdAt: period },
    include: { customer: { select: { name: true } }, deliveryOrder: { select: { orderNo: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const total = returns.reduce((s, r) => s + Number(r.totalValue), 0)
  const cashRefund = returns.filter((r) => r.refundCash).reduce((s, r) => s + Number(r.totalValue), 0)
  const creditDeduct = total - cashRefund

  const columns = [
    { header: 'رقم المرتجع' }, { header: 'التاريخ' }, { header: 'العميل' }, { header: 'الجولة' },
    { header: 'أصناف', align: 'center' as const }, { header: 'القيمة', align: 'end' as const },
    { header: 'النوع', align: 'center' as const }, { header: 'السبب' },
  ]
  const rows = returns.map((r) => [
    r.returnNo, dateShort(r.createdAt), r.customer?.name || r.customerName || '—', r.deliveryOrder?.orderNo || '—',
    fmt(r._count.items), <span key="v" className="font-bold text-red-600">{money(Number(r.totalValue))}</span>,
    <span key="t" className={`px-2 py-0.5 rounded text-xs font-semibold ${r.refundCash ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{r.refundCash ? 'رد نقدي' : 'خصم من الرصيد'}</span>,
    r.reason || '—',
  ])
  const exportRows = returns.map((r) => [r.returnNo, dateShort(r.createdAt), r.customer?.name || r.customerName || '—', r.deliveryOrder?.orderNo || '—', r._count.items, Number(r.totalValue).toFixed(2), r.refundCash ? 'رد نقدي' : 'خصم من الرصيد', r.reason || '—'])

  return (
    <ReportShell
      title="مرتجعات المبيعات" subtitle="البضاعة المرتجعة من العملاء خلال الفترة" basePath="/finance/returns"
      from={fromStr} to={toStr} exportName={`المرتجعات-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد المرتجعات', value: fmt(returns.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي قيمة المرتجع', value: money(total), color: 'text-red-600' },
        { label: 'رد نقدي', value: money(cashRefund), color: 'text-red-600' },
        { label: 'خصم من رصيد العملاء', value: money(creditDeduct), color: 'text-amber-600' },
      ]}
    >
      <ReportTable title="المرتجعات" columns={columns} rows={rows} emptyText="لا توجد مرتجعات في هذه الفترة 🎉"
        footer={['الإجمالي', '', '', '', '', money(total), '', '']} />
    </ReportShell>
  )
}
