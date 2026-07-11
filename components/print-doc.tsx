import { ReactNode } from 'react'

interface PrintDocProps {
  title: string
  docNo: string
  date: Date
  meta?: { label: string; value: string }[]
  children: ReactNode
  footerNote?: string
  signatures?: string[]
}

// مستند طباعة موحّد (A4) لأوامر التصنيع والشراء والتحميل والفواتير
export function PrintDoc({ title, docNo, date, meta = [], children, footerNote, signatures }: PrintDocProps) {
  return (
    <div className="print-area bg-white rounded-xl shadow-sm p-8 max-w-3xl mx-auto">
      {/* رأس الشركة */}
      <div className="flex items-start justify-between border-b-2 border-[#1a1a2e] pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Golden Coffee</h1>
          <p className="text-sm text-gray-500">مطاحن ومصانع البن الذهبية</p>
        </div>
        <div className="text-left">
          <p className="text-lg font-bold text-[#e94560]">{title}</p>
          <p className="text-sm font-semibold tabular-nums">{docNo}</p>
          <p className="text-xs text-gray-500 tabular-nums">
            {new Date(date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' — '}
            {new Date(date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* بيانات المستند */}
      {meta.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mb-6 text-sm">
          {meta.map((m) => (
            <div key={m.label} className="flex gap-2">
              <span className="text-gray-500">{m.label}:</span>
              <span className="font-semibold">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}

      {footerNote && <p className="text-sm text-gray-500 mt-6">{footerNote}</p>}

      {/* التوقيعات */}
      {signatures && signatures.length > 0 && (
        <div className="grid grid-cols-3 gap-8 mt-14">
          {signatures.map((s) => (
            <div key={s} className="text-center">
              <div className="border-t border-gray-400 pt-2 text-sm text-gray-600">{s}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PrintTable({
  headers,
  rows,
  totals,
}: {
  headers: string[]
  rows: (string | number)[][]
  totals?: { label: string; value: string }[]
}) {
  return (
    <div>
      <table className="w-full text-sm border border-gray-300">
        <thead>
          <tr className="bg-[#1a1a2e] text-white">
            {headers.map((h) => (
              <th key={h} className="p-2.5 text-right font-semibold border-l border-gray-600 last:border-l-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, j) => (
                <td key={j} className="p-2.5 border-t border-l border-gray-200 last:border-l-0 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totals && totals.length > 0 && (
        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1.5">
            {totals.map((t, i) => (
              <div
                key={t.label}
                className={`flex justify-between text-sm ${i === totals.length - 1 ? 'font-bold text-base border-t border-gray-300 pt-1.5' : ''}`}
              >
                <span className="text-gray-600">{t.label}</span>
                <span className="tabular-nums">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
