import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

// لا يوجد موديل مصروفات بعد — الصفحة جاهزة، وتُفعّل تلقائيًا عند إضافة الموديل
export default async function ExpensesReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr } = parsePeriod(searchParams)

  const columns = [{ header: 'التاريخ' }, { header: 'الفئة' }, { header: 'البيان' }, { header: 'المبلغ', align: 'end' as const }]

  return (
    <ReportShell
      title="المصروفات" subtitle="المصروفات التشغيلية (إيجار · رواتب · صيانة · مرافق...)" basePath="/finance/expenses"
      from={fromStr} to={toStr} exportName={`المصروفات-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={[]}
      kpis={[
        { label: 'عدد المصروفات', value: '0', color: 'text-[#0f3460]' },
        { label: 'إجمالي المصروفات', value: money(0), color: 'text-red-600' },
        { label: 'متوسط المصروف', value: money(0), color: 'text-[#0f3460]' },
        { label: 'أعلى فئة', value: '—', color: 'text-[#0f3460]' },
      ]}
    >
      <div className="bg-white rounded-xl shadow-sm p-8 text-center space-y-2">
        <p className="text-4xl">🧹</p>
        <p className="font-bold text-[#1a1a2e]">مفيش وحدة مصروفات مفعّلة لسه</p>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          دلوقتي بيتم حساب الأرباح كـ (مبيعات − تكلفة البضاعة) بدون مصروفات تشغيلية. لو عايز تسجّل المصروفات
          (إيجار/رواتب/كهرباء/صيانة) وتتخصم من صافي الربح — أقدر أضيف وحدة مصروفات كاملة بفئات.
        </p>
      </div>
      <ReportTable title="سجل المصروفات" columns={columns} rows={[]} emptyText="لا توجد مصروفات مسجّلة" />
    </ReportShell>
  )
}
