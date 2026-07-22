import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod, dateTime } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

interface Voucher { at: Date; type: 'قبض' | 'صرف'; no: string; party: string; amount: number; method: string }

export default async function VouchersReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [kaPays, supPays] = await Promise.all([
    prisma.keyAccountPayment.findMany({ where: { createdAt: period }, include: { keyAccount: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.supplierPayment.findMany({ where: { createdAt: period }, include: { supplier: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
  ])

  const vouchers: Voucher[] = [
    ...kaPays.map((p) => ({ at: p.createdAt, type: 'قبض' as const, no: p.receiptNo || '—', party: p.keyAccount?.name || '—', amount: Number(p.amount), method: p.method })),
    ...supPays.map((p) => ({ at: p.createdAt, type: 'صرف' as const, no: p.receiptNo || '—', party: p.supplier?.name || '—', amount: Number(p.amount), method: p.method })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime())

  const totalIn = vouchers.filter((v) => v.type === 'قبض').reduce((s, v) => s + v.amount, 0)
  const totalOut = vouchers.filter((v) => v.type === 'صرف').reduce((s, v) => s + v.amount, 0)

  const columns = [
    { header: 'النوع', align: 'center' as const }, { header: 'رقم السند' }, { header: 'التاريخ' },
    { header: 'الطرف' }, { header: 'الطريقة', align: 'center' as const }, { header: 'المبلغ', align: 'end' as const },
  ]
  const rows = vouchers.map((v) => [
    <span key="t" className={`px-2 py-0.5 rounded text-xs font-semibold ${v.type === 'قبض' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{v.type}</span>,
    v.no, dateTime(v.at), v.party, v.method,
    <span key="a" className={v.type === 'قبض' ? 'font-bold text-green-700' : 'font-bold text-red-600'}>{money(v.amount)}</span>,
  ])
  const exportRows = vouchers.map((v) => [v.type, v.no, dateTime(v.at), v.party, v.method, v.amount.toFixed(2)])

  return (
    <ReportShell
      title="السندات" subtitle="سندات القبض (تحصيل من كبار الموردين) وسندات الصرف (دفع للموردين)" basePath="/finance/vouchers"
      from={fromStr} to={toStr} exportName={`السندات-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد السندات', value: fmt(vouchers.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي سندات القبض', value: money(totalIn), color: 'text-green-600' },
        { label: 'إجمالي سندات الصرف', value: money(totalOut), color: 'text-red-600' },
        { label: 'الصافي', value: money(totalIn - totalOut), color: totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600' },
      ]}
    >
      <ReportTable title="السندات" columns={columns} rows={rows} emptyText="لا توجد سندات في هذه الفترة"
        footer={['', '', '', '', 'الإجمالي', money(totalIn - totalOut)]} />
    </ReportShell>
  )
}
