import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function SuppliersReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    include: {
      purchases: { where: { createdAt: period }, select: { totalAmount: true, paidAmount: true } },
      payments: { where: { createdAt: period }, select: { amount: true } },
    },
    orderBy: { totalPurchases: 'desc' },
  })

  const stat = suppliers.map((s) => ({
    name: s.name,
    phone: s.phone || '—',
    periodPurchases: s.purchases.reduce((a, p) => a + Number(p.totalAmount), 0),
    periodPaid: s.purchases.reduce((a, p) => a + Number(p.paidAmount), 0) + s.payments.reduce((a, p) => a + Number(p.amount), 0),
    total: Number(s.totalPurchases),
    balance: Number(s.balance),
  }))

  const totPurch = stat.reduce((s, x) => s + x.periodPurchases, 0)
  const totPaid = stat.reduce((s, x) => s + x.periodPaid, 0)
  const totBalance = stat.reduce((s, x) => s + x.balance, 0)

  const columns = [
    { header: 'المورد' }, { header: 'الهاتف', align: 'center' as const }, { header: 'مشتريات الفترة', align: 'end' as const },
    { header: 'المدفوع بالفترة', align: 'end' as const }, { header: 'إجمالي التعامل', align: 'end' as const }, { header: 'المستحق عليه', align: 'end' as const },
  ]
  const rows = stat.map((s) => [
    <span key="n" className="font-semibold">{s.name}</span>, s.phone, money(s.periodPurchases),
    <span key="p" className="text-emerald-600 font-semibold">{money(s.periodPaid)}</span>, money(s.total),
    <span key="b" className={s.balance > 0 ? 'font-bold text-red-600' : 'text-gray-400'}>{money(s.balance)}</span>,
  ])
  const exportRows = stat.map((s) => [s.name, s.phone, s.periodPurchases.toFixed(2), s.periodPaid.toFixed(2), s.total.toFixed(2), s.balance.toFixed(2)])

  return (
    <ReportShell
      title="كشف الموردين" subtitle="مشتريات ومدفوعات الفترة والمستحق لكل مورد" basePath="/finance/suppliers"
      from={fromStr} to={toStr} exportName={`كشف-الموردين-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد الموردين', value: fmt(stat.length), color: 'text-[#0f3460]' },
        { label: 'مشتريات الفترة', value: money(totPurch), color: 'text-[#0f3460]' },
        { label: 'المدفوع بالفترة', value: money(totPaid), color: 'text-emerald-600' },
        { label: 'إجمالي المستحق عليهم', value: money(totBalance), color: 'text-red-600' },
      ]}
    >
      <ReportTable title="الموردون" columns={columns} rows={rows}
        footer={['الإجمالي', '', money(totPurch), money(totPaid), '', money(totBalance)]} />
    </ReportShell>
  )
}
