import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function TreasuryReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [cashInvoices, settlements, kaPays, purchasePaid, supPays, pvOuts, customerCollections] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { status: 'COMPLETED', type: 'CASH', createdAt: period } }),
    prisma.settlement.aggregate({ _sum: { cashAmount: true }, where: { createdAt: period } }),
    prisma.keyAccountPayment.aggregate({ _sum: { amount: true }, where: { createdAt: period } }),
    prisma.purchase.aggregate({ _sum: { paidAmount: true }, where: { createdAt: period } }),
    prisma.supplierPayment.aggregate({ _sum: { amount: true }, where: { createdAt: period } }),
    prisma.paymentVoucher.aggregate({ _sum: { amount: true }, _count: true, where: { status: 'APPROVED', createdAt: period } }),
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { status: 'COMPLETED', type: 'CREDIT', createdAt: period, paidAmount: { gt: 0 } } }),
  ])

  const inPos = Number(cashInvoices._sum.paidAmount) || 0
  const inDelegates = Number(settlements._sum.cashAmount) || 0
  const inKa = Number(kaPays._sum.amount) || 0
  const inCollections = Number(customerCollections._sum.paidAmount) || 0
  const outPurchase = Number(purchasePaid._sum.paidAmount) || 0
  const outSupPay = Number(supPays._sum.amount) || 0
  const outVouchers = Number(pvOuts._sum.amount) || 0

  const totalIn = inPos + inDelegates + inKa + inCollections
  const totalOut = outPurchase + outSupPay + outVouchers
  const net = totalIn - totalOut

  interface TItem { label: string; type: 'وارد' | 'منصرف'; amount: number; note?: string }
  const allItems: TItem[] = [
    { label: 'تحصيل نقدي (نقطة البيع)', type: 'وارد', amount: inPos },
    { label: 'تحصيل المناديب نقدي', type: 'وارد', amount: inDelegates },
    { label: 'تحصيل من كبار الموردين', type: 'وارد', amount: inKa },
    { label: 'تحصيل ديون عملاء', type: 'وارد', amount: inCollections },
    { label: 'مدفوع للموردين وقت الشراء', type: 'منصرف', amount: outPurchase },
    { label: 'سندات صرف للموردين', type: 'منصرف', amount: outSupPay },
    { label: `سندات صرف الخزينة (${pvOuts._count || 0} سند)`, type: 'منصرف', amount: outVouchers },
  ]
  const items = allItems.filter(r => r.amount > 0)

  const columns = [{ header: 'البند' }, { header: 'النوع', align: 'center' as const }, { header: 'المبلغ', align: 'end' as const }, { header: 'النسبة', align: 'end' as const }]
  const rows = items.map(r => {
    const isIn = r.type === 'وارد'
    const base = isIn ? totalIn : totalOut
    return [
      r.label,
      <span key="t" className={`px-2 py-0.5 rounded text-xs font-semibold ${isIn ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{r.type}</span>,
      <span key="v" className={isIn ? 'font-semibold text-green-700' : 'font-semibold text-red-600'}>{money(r.amount)}</span>,
      <span key="p" className="text-xs text-gray-500 tabular-nums">{pct(r.amount, base)}%</span>,
    ]
  })
  const exportRows = [
    ...items.map(r => [r.label, r.type, r.amount.toFixed(2), `${pct(r.amount, r.type === 'وارد' ? totalIn : totalOut)}%`]),
    ['', '', '', ''],
    ['إجمالي الوارد', '', totalIn.toFixed(2), ''],
    ['إجمالي المنصرف', '', totalOut.toFixed(2), ''],
    ['صافي حركة الخزينة', '', net.toFixed(2), ''],
  ]

  return (
    <ReportShell
      title="حركة الخزينة" subtitle="الوارد والمنصرف النقدي — مبيعات · تحصيل · مشتريات · سندات صرف" basePath="/finance/treasury"
      from={fromStr} to={toStr} exportName={`حركة-الخزينة-${fromStr}_${toStr}`}
      exportHeaders={columns.map(c => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'إجمالي الوارد', value: money(totalIn), color: 'text-green-600' },
        { label: 'إجمالي المنصرف', value: money(totalOut), color: 'text-red-600' },
        { label: 'صافي الحركة', value: money(net), color: net >= 0 ? 'text-green-600' : 'text-red-600' },
        { label: 'سندات صرف الخزينة', value: fmt(pvOuts._count || 0), color: 'text-[#0f3460]' },
      ]}
    >
      {/* رسم بياني بسيط — شريط وارد/منصرف */}
      {(totalIn > 0 || totalOut > 0) && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-[#1a1a2e]">مقارنة الوارد والمنصرف</p>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1"><span className="text-green-600 font-semibold">الوارد</span><span className="tabular-nums font-bold text-green-600">{money(totalIn)}</span></div>
              <div className="h-4 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${pct(totalIn, Math.max(totalIn, totalOut))}%` }} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1"><span className="text-red-600 font-semibold">المنصرف</span><span className="tabular-nums font-bold text-red-600">{money(totalOut)}</span></div>
              <div className="h-4 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{ width: `${pct(totalOut, Math.max(totalIn, totalOut))}%` }} /></div>
            </div>
          </div>
        </div>
      )}

      <ReportTable title="بنود الخزينة" columns={columns} rows={rows}
        footer={['صافي حركة الخزينة', '', money(net), '']}
      />
    </ReportShell>
  )
}
