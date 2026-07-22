import { ReportDateFilter } from '@/components/report-date-filter'
import { ExportButtons } from '@/components/export-buttons'

export interface ReportKpi {
  label: string
  value: string
  color?: string
}

// غلاف موحّد لكل تقرير: عنوان + فلتر مدة + تصدير + بطاقات مؤشرات + المحتوى
export function ReportShell({
  title,
  subtitle,
  basePath,
  from,
  to,
  exportName,
  exportHeaders,
  exportRows,
  kpis,
  children,
}: {
  title: string
  subtitle?: string
  basePath: string
  from: string
  to: string
  exportName: string
  exportHeaders: string[]
  exportRows: (string | number)[][]
  kpis?: ReportKpi[]
  children: React.ReactNode
}) {
  return (
    <div className="p-4 sm:p-6 space-y-6 print-area">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportDateFilter from={from} to={to} basePath={basePath} />
          <ExportButtons fileName={exportName} headers={exportHeaders} rows={exportRows} />
        </div>
      </div>

      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white p-4 rounded-xl shadow-sm">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className={`text-lg font-bold tabular-nums ${k.color || 'text-[#1a1a2e]'}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
