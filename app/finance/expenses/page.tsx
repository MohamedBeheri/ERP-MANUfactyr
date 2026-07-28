import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod, dateTime } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

const ACTIVITY_LABEL: Record<string, string> = { OPERATING: 'تشغيلي', INVESTING: 'استثماري', FINANCING: 'تمويلي' }

export default async function ExpensesReport({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const vouchers = await prisma.paymentVoucher.findMany({
    where: { status: 'APPROVED', createdAt: period },
    include: {
      category: { select: { name: true, code: true, activity: true, affectsPL: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalAmount = vouchers.reduce((s, v) => s + Number(v.amount), 0)
  const opexOnly = vouchers.filter(v => v.category?.affectsPL !== false)
  const opexTotal = opexOnly.reduce((s, v) => s + Number(v.amount), 0)
  const avgVoucher = vouchers.length ? totalAmount / vouchers.length : 0

  // تجميع حسب البند
  const byCategory = new Map<string, { count: number; total: number; activity: string }>()
  vouchers.forEach(v => {
    const key = v.category?.name || 'بدون تصنيف'
    const prev = byCategory.get(key) || { count: 0, total: 0, activity: v.activity }
    prev.count++
    prev.total += Number(v.amount)
    byCategory.set(key, prev)
  })
  const catSorted = Array.from(byCategory.entries()).sort((a, b) => b[1].total - a[1].total)
  const topCategory = catSorted[0]?.[0] || '—'

  // تجميع حسب النشاط
  const byActivity = { OPERATING: 0, INVESTING: 0, FINANCING: 0 }
  vouchers.forEach(v => { byActivity[v.activity as keyof typeof byActivity] += Number(v.amount) })

  const columns = [
    { header: 'رقم السند' }, { header: 'التاريخ' }, { header: 'البند' },
    { header: 'النشاط', align: 'center' as const }, { header: 'الوصف' },
    { header: 'P&L', align: 'center' as const }, { header: 'المبلغ', align: 'end' as const },
  ]

  const rows = vouchers.map(v => {
    const actColor = v.activity === 'OPERATING' ? 'bg-blue-50 text-blue-700' : v.activity === 'INVESTING' ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'
    return [
      <span key="n" className="font-mono text-xs">{v.voucherNo}</span>,
      dateTime(v.createdAt),
      <span key="c" className="font-semibold">{v.category?.name || '—'}</span>,
      <span key="a" className={`px-2 py-0.5 rounded text-[10px] font-semibold ${actColor}`}>{ACTIVITY_LABEL[v.activity] || v.activity}</span>,
      <span key="d" className="text-gray-500 text-xs max-w-[200px] truncate block">{v.description}</span>,
      v.category?.affectsPL !== false
        ? <span key="p" className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-semibold">نعم</span>
        : <span key="p" className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">لا</span>,
      <span key="v" className="font-bold text-red-600">{money(Number(v.amount))}</span>,
    ]
  })

  const exportRows = vouchers.map(v => [
    v.voucherNo, dateTime(v.createdAt), v.category?.name || '—',
    ACTIVITY_LABEL[v.activity] || v.activity, v.description,
    v.category?.affectsPL !== false ? 'نعم' : 'لا', Number(v.amount).toFixed(2),
  ])

  return (
    <ReportShell
      title="المصروفات" subtitle="سندات الصرف وبنود المصروفات — تشغيلية واستثمارية وتمويلية" basePath="/finance/expenses"
      from={fromStr} to={toStr} exportName={`المصروفات-${fromStr}_${toStr}`}
      exportHeaders={columns.map(c => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد سندات الصرف', value: fmt(vouchers.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي المصروفات', value: money(totalAmount), color: 'text-red-600' },
        { label: 'مصروفات تشغيلية (P&L)', value: money(opexTotal), color: 'text-red-600' },
        { label: 'أعلى بند', value: topCategory, color: 'text-[#0f3460]' },
      ]}
    >
      {/* تجميع حسب البند */}
      {catSorted.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <h3 className="text-base font-bold text-[#1a1a2e]">تجميع حسب البند</h3>
            <span className="mr-auto text-xs text-gray-400">{catSorted.length} بند</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                  <th className="p-3 font-medium">البند</th>
                  <th className="p-3 font-medium">النشاط</th>
                  <th className="p-3 font-medium text-center">عدد السندات</th>
                  <th className="p-3 font-medium text-left">المبلغ</th>
                  <th className="p-3 font-medium text-left">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {catSorted.map(([name, data]) => (
                  <tr key={name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-semibold">{name}</td>
                    <td className="p-3 text-xs text-gray-500">{ACTIVITY_LABEL[data.activity] || data.activity}</td>
                    <td className="p-3 tabular-nums text-center">{data.count}</td>
                    <td className="p-3 tabular-nums font-semibold text-red-600 text-left">{money(data.total)}</td>
                    <td className="p-3 text-left">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-xs">{pct(data.total, totalAmount)}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{ width: `${pct(data.total, totalAmount)}%` }} /></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="p-3">الإجمالي</td>
                  <td className="p-3" />
                  <td className="p-3 tabular-nums text-center">{vouchers.length}</td>
                  <td className="p-3 tabular-nums text-red-600 text-left">{money(totalAmount)}</td>
                  <td className="p-3 text-left">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* تجميع حسب نوع النشاط */}
      {totalAmount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['OPERATING', 'INVESTING', 'FINANCING'] as const).map(act => (
            <div key={act} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">{ACTIVITY_LABEL[act]}</p>
              <p className="text-lg font-bold tabular-nums text-[#1a1a2e]">{money(byActivity[act])}</p>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${act === 'OPERATING' ? 'bg-blue-400' : act === 'INVESTING' ? 'bg-purple-400' : 'bg-teal-400'}`} style={{ width: `${pct(byActivity[act], totalAmount)}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 tabular-nums">{pct(byActivity[act], totalAmount)}% من الإجمالي</p>
            </div>
          ))}
        </div>
      )}

      {/* السجل التفصيلي */}
      <ReportTable title="سجل المصروفات التفصيلي" columns={columns} rows={rows}
        emptyText="لا توجد سندات صرف في هذه الفترة"
        footer={['', '', '', '', '', 'الإجمالي', money(totalAmount)]}
      />
    </ReportShell>
  )
}
