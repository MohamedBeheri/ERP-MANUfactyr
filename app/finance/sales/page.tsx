import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod, dateShort } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function SalesSummaryReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const invoices = await prisma.invoice.findMany({
    where: { status: 'COMPLETED', createdAt: period },
    include: { customer: { select: { name: true } }, delegate: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const gross = invoices.reduce((s, i) => s + Number(i.totalAmount), 0)
  const net = invoices.reduce((s, i) => s + Number(i.netAmount), 0)
  const discount = Math.max(0, gross - net)
  const cash = invoices.filter((i) => i.type === 'CASH').reduce((s, i) => s + Number(i.netAmount), 0)
  const credit = invoices.filter((i) => i.type === 'CREDIT').reduce((s, i) => s + Number(i.netAmount), 0)
  const paid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
  const avg = invoices.length ? net / invoices.length : 0

  const columns = [
    { header: 'رقم الفاتورة' }, { header: 'التاريخ' }, { header: 'العميل' }, { header: 'المندوب' },
    { header: 'النوع', align: 'center' as const }, { header: 'الإجمالي', align: 'end' as const },
    { header: 'الخصم', align: 'end' as const }, { header: 'الصافي', align: 'end' as const }, { header: 'المدفوع', align: 'end' as const },
  ]
  const rows = invoices.map((i) => [
    i.invoiceNo,
    dateShort(i.createdAt),
    i.customer?.name || '—',
    i.delegate?.name || 'نقطة بيع',
    <span key="t" className={`px-2 py-0.5 rounded text-xs font-semibold ${i.type === 'CASH' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{i.type === 'CASH' ? 'نقدي' : 'آجل'}</span>,
    money(Number(i.totalAmount)),
    money(Math.max(0, Number(i.totalAmount) - Number(i.netAmount))),
    <span key="n" className="font-bold">{money(Number(i.netAmount))}</span>,
    money(Number(i.paidAmount)),
  ])
  const exportRows = invoices.map((i) => [
    i.invoiceNo, dateShort(i.createdAt), i.customer?.name || '—', i.delegate?.name || 'نقطة بيع',
    i.type === 'CASH' ? 'نقدي' : 'آجل', Number(i.totalAmount).toFixed(2),
    Math.max(0, Number(i.totalAmount) - Number(i.netAmount)).toFixed(2), Number(i.netAmount).toFixed(2), Number(i.paidAmount).toFixed(2),
  ])

  return (
    <ReportShell
      title="ملخص المبيعات" subtitle="كل فواتير المبيعات خلال الفترة المحددة" basePath="/finance/sales"
      from={fromStr} to={toStr} exportName={`ملخص-المبيعات-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد الفواتير', value: fmt(invoices.length), color: 'text-[#0f3460]' },
        { label: 'صافي المبيعات', value: money(net), color: 'text-green-600' },
        { label: 'محصّل نقدي', value: money(cash), color: 'text-emerald-600' },
        { label: 'آجل', value: money(credit), color: 'text-amber-600' },
        { label: 'إجمالي قبل الخصم', value: money(gross), color: 'text-[#1a1a2e]' },
        { label: 'إجمالي الخصومات', value: money(discount), color: 'text-red-600' },
        { label: 'المدفوع فعليًا', value: money(paid), color: 'text-[#0f3460]' },
        { label: 'متوسط الفاتورة', value: money(avg), color: 'text-[#0f3460]' },
      ]}
    >
      <ReportTable title="الفواتير" columns={columns} rows={rows} footer={['الإجمالي', '', '', '', '', money(gross), money(discount), money(net), money(paid)]} />
    </ReportShell>
  )
}
