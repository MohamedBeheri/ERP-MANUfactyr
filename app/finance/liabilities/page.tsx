import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod, dateShort } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  SUPPLIER: 'مورد', REAL_ESTATE: 'عقارات', INSURANCE: 'تأمين',
  LOAN: 'قرض', FINANCING_COMPANY: 'شركة تمويل', OTHER: 'أخرى',
}
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'نشط', cls: 'bg-blue-50 text-blue-700' },
  OVERDUE: { label: 'متأخر', cls: 'bg-red-50 text-red-700' },
  SETTLED: { label: 'مسدد', cls: 'bg-green-50 text-green-700' },
  CANCELLED: { label: 'ملغي', cls: 'bg-gray-100 text-gray-500' },
}

export default async function LiabilitiesReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr } = parsePeriod(searchParams)

  const liabilities = await prisma.liability.findMany({
    include: {
      installments: { orderBy: { dueDate: 'asc' }, select: { amount: true, paidAmount: true, dueDate: true, status: true } },
      _count: { select: { installments: true, paymentVouchers: true } },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  })

  const active = liabilities.filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE')
  const totalAll = liabilities.reduce((s, l) => s + Number(l.totalAmount), 0)
  const totalPaid = liabilities.reduce((s, l) => s + Number(l.paidAmount), 0)
  const totalRemaining = liabilities.reduce((s, l) => s + Number(l.remainingAmount), 0)
  const overdueCount = liabilities.filter(l => l.status === 'OVERDUE').length

  // الأقساط القادمة (أقرب 10)
  const upcomingInstallments = liabilities
    .flatMap(l => l.installments.filter(i => i.status !== 'PAID').map(i => ({ ...i, creditor: l.creditor, liabilityNo: l.liabilityNo })))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 10)

  // حسب النوع
  const byType = new Map<string, { count: number; total: number; remaining: number }>()
  liabilities.forEach(l => {
    const key = l.type
    const prev = byType.get(key) || { count: 0, total: 0, remaining: 0 }
    prev.count++
    prev.total += Number(l.totalAmount)
    prev.remaining += Number(l.remainingAmount)
    byType.set(key, prev)
  })

  const columns = [
    { header: 'رقم' }, { header: 'النوع' }, { header: 'الجهة الدائنة' },
    { header: 'الحالة', align: 'center' as const }, { header: 'الإجمالي', align: 'end' as const },
    { header: 'المدفوع', align: 'end' as const }, { header: 'المتبقي', align: 'end' as const },
    { header: 'الاستحقاق' }, { header: 'أقساط' },
  ]
  const rows = liabilities.map(l => {
    const st = STATUS_LABEL[l.status] || STATUS_LABEL.ACTIVE
    return [
      <span key="n" className="font-mono text-xs">{l.liabilityNo}</span>,
      <span key="t" className="text-xs text-gray-500">{TYPE_LABEL[l.type] || l.type}</span>,
      <span key="c" className="font-semibold">{l.creditor}</span>,
      <span key="s" className={`px-2 py-0.5 rounded text-[10px] font-semibold ${st.cls}`}>{st.label}</span>,
      <span key="total" className="tabular-nums">{money(Number(l.totalAmount))}</span>,
      <span key="paid" className="tabular-nums text-green-600">{money(Number(l.paidAmount))}</span>,
      <span key="rem" className={`tabular-nums font-semibold ${Number(l.remainingAmount) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{money(Number(l.remainingAmount))}</span>,
      <span key="due" className="text-xs tabular-nums">{l.dueDate ? dateShort(l.dueDate) : '—'}</span>,
      <span key="inst" className="text-xs text-gray-500 tabular-nums">{l._count.installments || '—'}</span>,
    ]
  })
  const exportRows = liabilities.map(l => [
    l.liabilityNo, TYPE_LABEL[l.type] || l.type, l.creditor, STATUS_LABEL[l.status]?.label || l.status,
    Number(l.totalAmount).toFixed(2), Number(l.paidAmount).toFixed(2), Number(l.remainingAmount).toFixed(2),
    l.dueDate ? dateShort(l.dueDate) : '—', l._count.installments,
  ])

  return (
    <ReportShell
      title="الالتزامات والأقساط" subtitle="القروض والتمويل والتأمين والعقارات — الأرصدة والأقساط المستحقة" basePath="/finance/liabilities"
      from={fromStr} to={toStr} exportName={`الالتزامات`}
      exportHeaders={columns.map(c => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد الالتزامات', value: fmt(liabilities.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي الالتزامات', value: money(totalAll), color: 'text-[#0f3460]' },
        { label: 'المتبقي', value: money(totalRemaining), color: 'text-red-600' },
        { label: 'متأخرة', value: fmt(overdueCount), color: overdueCount > 0 ? 'text-red-600' : 'text-green-600' },
      ]}
    >
      {/* حسب النوع */}
      {byType.size > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from(byType.entries()).map(([type, data]) => (
            <div key={type} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">{TYPE_LABEL[type] || type}</p>
              <p className="text-sm font-bold tabular-nums text-[#1a1a2e]">{data.count} التزام</p>
              <p className="text-xs tabular-nums text-red-500 mt-0.5">متبقي: {money(data.remaining)}</p>
              {totalAll > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct(data.remaining, totalRemaining || 1)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* نسبة السداد */}
      {totalAll > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-sm font-bold text-[#1a1a2e] mb-2">نسبة السداد الإجمالية</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct(totalPaid, totalAll)}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums text-green-600">{pct(totalPaid, totalAll)}%</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>مدفوع: {money(totalPaid)}</span>
            <span>متبقي: {money(totalRemaining)}</span>
            <span>إجمالي: {money(totalAll)}</span>
          </div>
        </div>
      )}

      {/* الأقساط القادمة */}
      {upcomingInstallments.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <h3 className="text-base font-bold text-[#1a1a2e]">أقرب الأقساط المستحقة</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">الجهة</th>
                <th className="p-3 font-medium">تاريخ الاستحقاق</th>
                <th className="p-3 font-medium text-left">المبلغ</th>
                <th className="p-3 font-medium text-left">المدفوع</th>
                <th className="p-3 font-medium text-left">المتبقي</th>
              </tr></thead>
              <tbody>
                {upcomingInstallments.map((i, idx) => {
                  const rem = Number(i.amount) - Number(i.paidAmount)
                  const overdue = new Date(i.dueDate) < new Date()
                  return (
                    <tr key={idx} className={`border-b border-gray-50 last:border-0 ${overdue ? 'bg-red-50/50' : 'hover:bg-gray-50/50'}`}>
                      <td className="p-3 font-semibold">{i.creditor}</td>
                      <td className="p-3 tabular-nums text-xs">{dateShort(i.dueDate)}{overdue && <span className="mr-1 text-red-600 text-[10px] font-semibold">متأخر</span>}</td>
                      <td className="p-3 tabular-nums text-left">{money(Number(i.amount))}</td>
                      <td className="p-3 tabular-nums text-left text-green-600">{money(Number(i.paidAmount))}</td>
                      <td className="p-3 tabular-nums text-left font-semibold text-red-600">{money(rem)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ReportTable title="سجل الالتزامات" columns={columns} rows={rows}
        emptyText="لا توجد التزامات مسجّلة"
        footer={['', '', 'الإجمالي', '', money(totalAll), money(totalPaid), money(totalRemaining), '', '']}
      />
    </ReportShell>
  )
}
