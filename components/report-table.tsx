import { FileBarChart2 } from 'lucide-react'

export interface Column {
  header: string
  // محاذاة العمود
  align?: 'start' | 'center' | 'end'
  // خلية مميّزة (لون/خط)
  className?: string
}

// جدول تقرير عام: أعمدة + صفوف (كل خلية نص أو عنصر) + صف إجمالي اختياري + عنوان
export function ReportTable({
  title,
  icon,
  columns,
  rows,
  footer,
  emptyText = 'لا توجد بيانات في هذه الفترة',
}: {
  title?: string
  icon?: React.ReactNode
  columns: Column[]
  rows: React.ReactNode[][]
  footer?: React.ReactNode[]
  emptyText?: string
}) {
  const alignClass = (a?: string) => (a === 'end' ? 'text-left' : a === 'center' ? 'text-center' : 'text-right')

  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 p-5 pb-3">
          {icon || <FileBarChart2 className="w-5 h-5 text-[#0f3460]" />}
          <h3 className="text-base font-bold text-[#1a1a2e]">{title}</h3>
          <span className="mr-auto text-xs text-gray-400 tabular-nums">{rows.length} سطر</span>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-y border-gray-100 bg-gray-50/50">
                {columns.map((c, i) => (
                  <th key={i} className={`p-3 font-medium ${alignClass(c.align)}`}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  {r.map((cell, ci) => (
                    <td key={ci} className={`p-3 tabular-nums ${alignClass(columns[ci]?.align)} ${columns[ci]?.className || ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  {footer.map((cell, ci) => (
                    <td key={ci} className={`p-3 tabular-nums ${alignClass(columns[ci]?.align)}`}>{cell}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}
