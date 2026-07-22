import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function SalesByTypeReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [invoices, supplyAgg] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: 'COMPLETED', createdAt: period },
      select: { netAmount: true, type: true, paymentMethod: true, customer: { select: { customerType: true } } },
    }),
    prisma.keyAccountSupply.aggregate({ _sum: { netAmount: true }, _count: true, where: { createdAt: period } }),
  ])

  const totalNet = invoices.reduce((s, i) => s + Number(i.netAmount), 0)
  const supplyNet = Number(supplyAgg._sum.netAmount) || 0
  const grand = totalNet + supplyNet

  // حسب طريقة الدفع (نقدي/آجل)
  const byPay = { CASH: { c: 0, v: 0 }, CREDIT: { c: 0, v: 0 } }
  // حسب نوع العميل (قطاعي/جملة)
  const byCust = { RETAIL: { c: 0, v: 0 }, WHOLESALE: { c: 0, v: 0 } }
  for (const i of invoices) {
    byPay[i.type].c++; byPay[i.type].v += Number(i.netAmount)
    const ct = i.customer?.customerType || 'RETAIL'
    byCust[ct].c++; byCust[ct].v += Number(i.netAmount)
  }

  const col3 = [{ header: 'النوع' }, { header: 'عدد', align: 'center' as const }, { header: 'صافي المبيعات', align: 'end' as const }, { header: 'النسبة', align: 'end' as const }]

  const payRows = [
    ['نقدي فوري', byPay.CASH.c, byPay.CASH.v],
    ['آجل', byPay.CREDIT.c, byPay.CREDIT.v],
  ]
  const custRows = [
    ['قطاعي', byCust.RETAIL.c, byCust.RETAIL.v],
    ['جملة', byCust.WHOLESALE.c, byCust.WHOLESALE.v],
  ]
  const channelRows = [
    ['فواتير مبيعات مباشرة', invoices.length, totalNet],
    ['توريدات كبار الموردين', supplyAgg._count || 0, supplyNet],
  ]

  const toCells = (r: (string | number)[], base: number) => [r[0], fmt(Number(r[1])), money(Number(r[2])), `${pct(Number(r[2]), base)}%`]
  const exportRows = [
    ['— حسب طريقة الدفع —', '', '', ''],
    ...payRows.map((r) => [r[0], r[1], Number(r[2]).toFixed(2), `${pct(Number(r[2]), totalNet)}%`]),
    ['— حسب نوع العميل —', '', '', ''],
    ...custRows.map((r) => [r[0], r[1], Number(r[2]).toFixed(2), `${pct(Number(r[2]), totalNet)}%`]),
    ['— حسب القناة —', '', '', ''],
    ...channelRows.map((r) => [r[0], r[1], Number(r[2]).toFixed(2), `${pct(Number(r[2]), grand)}%`]),
  ]

  return (
    <ReportShell
      title="المبيعات حسب النوع" subtitle="توزيع المبيعات على طريقة الدفع ونوع العميل والقناة" basePath="/finance/by-type"
      from={fromStr} to={toStr} exportName={`المبيعات-حسب-النوع-${fromStr}_${toStr}`}
      exportHeaders={['البيان', 'عدد', 'صافي', 'النسبة']} exportRows={exportRows}
      kpis={[
        { label: 'إجمالي المبيعات', value: money(grand), color: 'text-green-600' },
        { label: 'نقدي', value: money(byPay.CASH.v), color: 'text-emerald-600' },
        { label: 'آجل', value: money(byPay.CREDIT.v), color: 'text-amber-600' },
        { label: 'توريدات كبار الموردين', value: money(supplyNet), color: 'text-[#0f3460]' },
      ]}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ReportTable title="حسب طريقة الدفع" columns={col3} rows={payRows.map((r) => toCells(r, totalNet))} />
        <ReportTable title="حسب نوع العميل" columns={col3} rows={custRows.map((r) => toCells(r, totalNet))} />
        <ReportTable title="حسب القناة" columns={col3} rows={channelRows.map((r) => toCells(r, grand))} />
      </div>
    </ReportShell>
  )
}
