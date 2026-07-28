import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod, dateShort } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function PurchasesReport({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [purchases, suppliers] = await Promise.all([
    prisma.purchase.findMany({
      where: { createdAt: period },
      include: {
        supplier: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        purchases: { where: { createdAt: period }, select: { totalAmount: true, paidAmount: true } },
        payments: { where: { createdAt: period }, select: { amount: true } },
      },
      orderBy: { totalPurchases: 'desc' },
    }),
  ])

  const totalAmount = purchases.reduce((s, p) => s + Number(p.totalAmount), 0)
  const totalPaid = purchases.reduce((s, p) => s + Number(p.paidAmount), 0)
  const totalRemaining = totalAmount - totalPaid
  const avgPurchase = purchases.length ? totalAmount / purchases.length : 0

  // حسب المورد
  const bySupplier = suppliers.map(s => {
    const pTotal = s.purchases.reduce((a, p) => a + Number(p.totalAmount), 0)
    const pPaid = s.purchases.reduce((a, p) => a + Number(p.paidAmount), 0)
    const extraPaid = s.payments.reduce((a, p) => a + Number(p.amount), 0)
    return { name: s.name, total: pTotal, paid: pPaid + extraPaid, balance: Number(s.balance) }
  }).filter(s => s.total > 0 || s.balance > 0).sort((a, b) => b.total - a.total)

  const columns = [
    { header: 'رقم الفاتورة' }, { header: 'التاريخ' }, { header: 'المورد' },
    { header: 'الأصناف' }, { header: 'الإجمالي', align: 'end' as const },
    { header: 'المدفوع', align: 'end' as const }, { header: 'المتبقي', align: 'end' as const },
  ]
  const rows = purchases.map(p => [
    <span key="n" className="font-mono text-xs font-semibold">{p.invoiceNo || '—'}</span>,
    dateShort(p.createdAt),
    <span key="s" className="font-semibold">{p.supplier?.name || '—'}</span>,
    <span key="i" className="text-xs text-gray-500">{p.items.map(i => `${i.product.name} ×${i.quantity}`).join('، ')}</span>,
    <span key="t" className="font-semibold tabular-nums">{money(Number(p.totalAmount))}</span>,
    <span key="p" className="tabular-nums text-green-600">{money(Number(p.paidAmount))}</span>,
    <span key="r" className={`tabular-nums font-semibold ${Number(p.totalAmount) - Number(p.paidAmount) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{money(Number(p.totalAmount) - Number(p.paidAmount))}</span>,
  ])
  const exportRows = purchases.map(p => [
    p.invoiceNo || '—', dateShort(p.createdAt), p.supplier?.name || '—',
    p.items.map(i => `${i.product.name} ×${i.quantity}`).join(', '),
    Number(p.totalAmount).toFixed(2), Number(p.paidAmount).toFixed(2),
    (Number(p.totalAmount) - Number(p.paidAmount)).toFixed(2),
  ])

  return (
    <ReportShell
      title="تقرير المشتريات" subtitle="أوامر الشراء وتوزيعها على الموردين — الفترة والسداد" basePath="/finance/purchases"
      from={fromStr} to={toStr} exportName={`المشتريات-${fromStr}_${toStr}`}
      exportHeaders={columns.map(c => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد الأوامر', value: fmt(purchases.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي المشتريات', value: money(totalAmount), color: 'text-[#0f3460]' },
        { label: 'المدفوع', value: money(totalPaid), color: 'text-green-600' },
        { label: 'المتبقي', value: money(totalRemaining), color: 'text-red-600' },
      ]}
    >
      {/* حسب المورد */}
      {bySupplier.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <h3 className="text-base font-bold text-[#1a1a2e]">توزيع المشتريات حسب المورد</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">المورد</th>
                <th className="p-3 font-medium text-left">مشتريات الفترة</th>
                <th className="p-3 font-medium text-left">المدفوع</th>
                <th className="p-3 font-medium text-left">رصيد مفتوح (كل الوقت)</th>
                <th className="p-3 font-medium text-left">النسبة</th>
              </tr></thead>
              <tbody>
                {bySupplier.map(s => (
                  <tr key={s.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-semibold">{s.name}</td>
                    <td className="p-3 tabular-nums text-left">{money(s.total)}</td>
                    <td className="p-3 tabular-nums text-left text-green-600">{money(s.paid)}</td>
                    <td className="p-3 tabular-nums text-left"><span className={s.balance > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>{money(s.balance)}</span></td>
                    <td className="p-3 text-left"><div className="flex items-center gap-2"><span className="tabular-nums text-xs">{pct(s.total, totalAmount)}%</span><div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct(s.total, totalAmount)}%` }} /></div></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ReportTable title="سجل المشتريات" columns={columns} rows={rows}
        emptyText="لا توجد مشتريات في هذه الفترة"
        footer={['', '', '', 'الإجمالي', money(totalAmount), money(totalPaid), money(totalRemaining)]}
      />
    </ReportShell>
  )
}
