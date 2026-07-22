import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function TreasuryReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [cashInvoices, settlements, kaPays, purchasePaid, supPays] = await Promise.all([
    // نقدية مبيعات نقطة البيع (فواتير نقدي مدفوعة)
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { status: 'COMPLETED', type: 'CASH', createdAt: period } }),
    // تحصيل المناديب نقدي من التسويات
    prisma.settlement.aggregate({ _sum: { cashAmount: true }, where: { createdAt: period } }),
    // تحصيل من كبار الموردين (سندات قبض)
    prisma.keyAccountPayment.aggregate({ _sum: { amount: true }, where: { createdAt: period } }),
    // مدفوع للموردين وقت الشراء
    prisma.purchase.aggregate({ _sum: { paidAmount: true }, where: { createdAt: period } }),
    // سندات صرف للموردين
    prisma.supplierPayment.aggregate({ _sum: { amount: true }, where: { createdAt: period } }),
  ])

  const inPos = Number(cashInvoices._sum.paidAmount) || 0
  const inDelegates = Number(settlements._sum.cashAmount) || 0
  const inKa = Number(kaPays._sum.amount) || 0
  const outPurchase = Number(purchasePaid._sum.paidAmount) || 0
  const outSupPay = Number(supPays._sum.amount) || 0

  const totalIn = inPos + inDelegates + inKa
  const totalOut = outPurchase + outSupPay
  const net = totalIn - totalOut

  const columns = [{ header: 'البند' }, { header: 'النوع', align: 'center' as const }, { header: 'المبلغ', align: 'end' as const }]
  const rows = [
    ['تحصيل نقدي (نقطة البيع)', 'وارد', inPos],
    ['تحصيل المناديب نقدي', 'وارد', inDelegates],
    ['تحصيل من كبار الموردين', 'وارد', inKa],
    ['مدفوع للموردين وقت الشراء', 'منصرف', outPurchase],
    ['سندات صرف للموردين', 'منصرف', outSupPay],
  ].map((r) => {
    const isIn = r[1] === 'وارد'
    return [
      r[0],
      <span key="t" className={`px-2 py-0.5 rounded text-xs font-semibold ${isIn ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{r[1]}</span>,
      <span key="v" className={isIn ? 'font-semibold text-green-700' : 'font-semibold text-red-600'}>{money(Number(r[2]))}</span>,
    ]
  })
  const exportRows = [
    ['تحصيل نقدي (نقطة البيع)', 'وارد', inPos.toFixed(2)],
    ['تحصيل المناديب نقدي', 'وارد', inDelegates.toFixed(2)],
    ['تحصيل من كبار الموردين', 'وارد', inKa.toFixed(2)],
    ['مدفوع للموردين وقت الشراء', 'منصرف', outPurchase.toFixed(2)],
    ['سندات صرف للموردين', 'منصرف', outSupPay.toFixed(2)],
    ['صافي حركة الخزينة', '', net.toFixed(2)],
  ]

  return (
    <ReportShell
      title="حركة الخزينة" subtitle="الوارد والمنصرف النقدي خلال الفترة" basePath="/finance/treasury"
      from={fromStr} to={toStr} exportName={`حركة-الخزينة-${fromStr}_${toStr}`}
      exportHeaders={['البند', 'النوع', 'المبلغ']} exportRows={exportRows}
      kpis={[
        { label: 'إجمالي الوارد', value: money(totalIn), color: 'text-green-600' },
        { label: 'إجمالي المنصرف', value: money(totalOut), color: 'text-red-600' },
        { label: 'صافي الحركة', value: money(net), color: net >= 0 ? 'text-green-600' : 'text-red-600' },
        { label: 'نسبة التحصيل النقدي', value: money(totalIn), color: 'text-emerald-600' },
      ]}
    >
      <ReportTable title="بنود الخزينة" columns={columns} rows={rows} footer={['صافي حركة الخزينة', '', money(net)]} />
    </ReportShell>
  )
}
