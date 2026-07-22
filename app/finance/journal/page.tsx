import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { money, parsePeriod, dateTime } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

interface Entry { at: Date; kind: string; desc: string; inAmt: number; outAmt: number; color: string }

export default async function JournalReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [invoices, supplies, purchases, supPays, kaPays] = await Promise.all([
    prisma.invoice.findMany({ where: { status: 'COMPLETED', createdAt: period }, select: { invoiceNo: true, netAmount: true, createdAt: true, customer: { select: { name: true } } } }),
    prisma.keyAccountSupply.findMany({ where: { createdAt: period }, select: { supplyNo: true, netAmount: true, createdAt: true, keyAccount: { select: { name: true } } } }),
    prisma.purchase.findMany({ where: { createdAt: period }, select: { invoiceNo: true, totalAmount: true, createdAt: true, supplier: { select: { name: true } } } }),
    prisma.supplierPayment.findMany({ where: { createdAt: period }, select: { receiptNo: true, amount: true, createdAt: true, supplier: { select: { name: true } } } }),
    prisma.keyAccountPayment.findMany({ where: { createdAt: period }, select: { receiptNo: true, amount: true, createdAt: true, keyAccount: { select: { name: true } } } }),
  ])

  const entries: Entry[] = [
    ...invoices.map((i) => ({ at: i.createdAt, kind: 'فاتورة مبيعات', desc: `${i.invoiceNo} — ${i.customer?.name || ''}`, inAmt: Number(i.netAmount), outAmt: 0, color: 'bg-green-50 text-green-700' })),
    ...supplies.map((s) => ({ at: s.createdAt, kind: 'توريد كبار موردين', desc: `${s.supplyNo} — ${s.keyAccount?.name || ''}`, inAmt: Number(s.netAmount), outAmt: 0, color: 'bg-green-50 text-green-700' })),
    ...kaPays.map((p) => ({ at: p.createdAt, kind: 'سند قبض', desc: `${p.receiptNo || ''} — ${p.keyAccount?.name || ''}`, inAmt: Number(p.amount), outAmt: 0, color: 'bg-emerald-50 text-emerald-700' })),
    ...purchases.map((p) => ({ at: p.createdAt, kind: 'أمر شراء', desc: `${p.invoiceNo} — ${p.supplier?.name || ''}`, inAmt: 0, outAmt: Number(p.totalAmount), color: 'bg-red-50 text-red-700' })),
    ...supPays.map((p) => ({ at: p.createdAt, kind: 'سند صرف', desc: `${p.receiptNo || ''} — ${p.supplier?.name || ''}`, inAmt: 0, outAmt: Number(p.amount), color: 'bg-red-50 text-red-700' })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime())

  const totalIn = entries.reduce((s, e) => s + e.inAmt, 0)
  const totalOut = entries.reduce((s, e) => s + e.outAmt, 0)

  const columns = [
    { header: 'التاريخ' }, { header: 'النوع', align: 'center' as const }, { header: 'البيان' },
    { header: 'وارد (+)', align: 'end' as const }, { header: 'منصرف (−)', align: 'end' as const },
  ]
  const rows = entries.map((e) => [
    dateTime(e.at),
    <span key="k" className={`px-2 py-0.5 rounded text-xs font-semibold ${e.color}`}>{e.kind}</span>,
    e.desc,
    e.inAmt ? <span key="i" className="font-semibold text-green-700">{money(e.inAmt)}</span> : '—',
    e.outAmt ? <span key="o" className="font-semibold text-red-600">{money(e.outAmt)}</span> : '—',
  ])
  const exportRows = entries.map((e) => [dateTime(e.at), e.kind, e.desc, e.inAmt ? e.inAmt.toFixed(2) : '', e.outAmt ? e.outAmt.toFixed(2) : ''])

  return (
    <ReportShell
      title="اليومية المالية" subtitle="كل الحركات المالية (مبيعات · توريدات · مشتريات · سندات) بترتيب زمني" basePath="/finance/journal"
      from={fromStr} to={toStr} exportName={`اليومية-المالية-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد الحركات', value: String(entries.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي الوارد', value: money(totalIn), color: 'text-green-600' },
        { label: 'إجمالي المنصرف', value: money(totalOut), color: 'text-red-600' },
        { label: 'صافي الحركة', value: money(totalIn - totalOut), color: totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600' },
      ]}
    >
      <ReportTable title="القيود" columns={columns} rows={rows} footer={['الإجمالي', '', '', money(totalIn), money(totalOut)]} />
    </ReportShell>
  )
}
