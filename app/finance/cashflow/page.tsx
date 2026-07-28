import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod, dateTime } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

const ACT_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  OPERATING: { label: 'تشغيلي', color: 'text-blue-700', bg: 'bg-blue-50' },
  INVESTING: { label: 'استثماري', color: 'text-purple-700', bg: 'bg-purple-50' },
  FINANCING: { label: 'تمويلي', color: 'text-teal-700', bg: 'bg-teal-50' },
}

export default async function CashFlowReport({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const flows = await prisma.cashFlow.findMany({
    where: { createdAt: period },
    orderBy: { createdAt: 'desc' },
    select: { id: true, description: true, type: true, amount: true, activity: true, reference: true, createdAt: true },
  })

  const totalIn = flows.filter(f => f.type === 'IN').reduce((s, f) => s + Number(f.amount), 0)
  const totalOut = flows.filter(f => f.type === 'OUT').reduce((s, f) => s + Number(f.amount), 0)
  const net = totalIn - totalOut

  // حسب النشاط
  const byActivity: Record<string, { in: number; out: number }> = { OPERATING: { in: 0, out: 0 }, INVESTING: { in: 0, out: 0 }, FINANCING: { in: 0, out: 0 } }
  flows.forEach(f => {
    const act = byActivity[f.activity] || (byActivity[f.activity] = { in: 0, out: 0 })
    if (f.type === 'IN') act.in += Number(f.amount)
    else act.out += Number(f.amount)
  })

  const columns = [
    { header: 'التاريخ' }, { header: 'المرجع' }, { header: 'الوصف' },
    { header: 'النشاط', align: 'center' as const }, { header: 'النوع', align: 'center' as const },
    { header: 'المبلغ', align: 'end' as const },
  ]
  const rows = flows.map(f => {
    const isIn = f.type === 'IN'
    const act = ACT_LABEL[f.activity] || ACT_LABEL.OPERATING
    return [
      <span key="d" className="text-xs tabular-nums">{dateTime(f.createdAt)}</span>,
      <span key="r" className="font-mono text-[11px] text-gray-500">{f.reference || '—'}</span>,
      <span key="desc" className="text-xs text-gray-700 max-w-[250px] truncate block">{f.description}</span>,
      <span key="a" className={`px-2 py-0.5 rounded text-[10px] font-semibold ${act.bg} ${act.color}`}>{act.label}</span>,
      <span key="t" className={`px-2 py-0.5 rounded text-xs font-semibold ${isIn ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{isIn ? 'وارد' : 'منصرف'}</span>,
      <span key="v" className={`font-bold ${isIn ? 'text-green-700' : 'text-red-600'}`}>{isIn ? '+' : '−'} {money(Number(f.amount))}</span>,
    ]
  })
  const exportRows = flows.map(f => [
    dateTime(f.createdAt), f.reference || '—', f.description,
    ACT_LABEL[f.activity]?.label || f.activity, f.type === 'IN' ? 'وارد' : 'منصرف',
    (f.type === 'IN' ? '+' : '-') + Number(f.amount).toFixed(2),
  ])

  return (
    <ReportShell
      title="قائمة التدفقات النقدية" subtitle="Cash Flow Statement — تشغيلي · استثماري · تمويلي" basePath="/finance/cashflow"
      from={fromStr} to={toStr} exportName={`التدفقات-النقدية-${fromStr}_${toStr}`}
      exportHeaders={columns.map(c => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'إجمالي الوارد', value: money(totalIn), color: 'text-green-600' },
        { label: 'إجمالي المنصرف', value: money(totalOut), color: 'text-red-600' },
        { label: 'صافي التدفق', value: money(net), color: net >= 0 ? 'text-green-600' : 'text-red-600' },
        { label: 'عدد الحركات', value: fmt(flows.length), color: 'text-[#0f3460]' },
      ]}
    >
      {/* ملخص حسب النشاط */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['OPERATING', 'INVESTING', 'FINANCING'] as const).map(act => {
          const data = byActivity[act]
          const actNet = data.in - data.out
          const lbl = ACT_LABEL[act]
          return (
            <div key={act} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${lbl.bg} ${lbl.color}`}>{lbl.label}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">وارد</span><span className="font-bold tabular-nums text-green-600">{money(data.in)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">منصرف</span><span className="font-bold tabular-nums text-red-600">{money(data.out)}</span></div>
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="font-bold text-[#1a1a2e]">الصافي</span>
                  <span className={`font-bold tabular-nums ${actNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money(actNet)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* صافي الحركة الكلي */}
      <div className={`rounded-xl px-5 py-4 flex items-center justify-between text-white ${net >= 0 ? 'bg-gradient-to-l from-green-600 to-emerald-500' : 'bg-gradient-to-l from-red-600 to-red-500'}`}>
        <p className="text-sm font-bold">صافي التدفقات النقدية (Net Cash Flow)</p>
        <p className="text-xl font-extrabold tabular-nums">{money(net)}</p>
      </div>

      <ReportTable title="سجل التدفقات" columns={columns} rows={rows}
        emptyText="لا توجد حركات نقدية في هذه الفترة"
        footer={['', '', '', '', 'الصافي', money(net)]}
      />
    </ReportShell>
  )
}
