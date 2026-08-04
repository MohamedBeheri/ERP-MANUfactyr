'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

// فلتر مدة (من / إلى) لصفحة التقارير — زي التقرير الشامل بتاع الكافيه
export function ReportDateFilter({ from, to, basePath = '/finance' }: { from: string; to: string; basePath?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)

  // نحافظ على باقي الفلاتر (منطقة/مندوب...) مع تغيير المدة
  const withCurrent = (fromVal: string, toVal: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (fromVal) params.set('from', fromVal); else params.delete('from')
    if (toVal) params.set('to', toVal); else params.delete('to')
    return params.toString()
  }

  const apply = () => {
    router.push(`${basePath}?${withCurrent(f, t)}`)
  }

  const quick = (days: number) => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - days + 1)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    setF(iso(start)); setT(iso(now))
    router.push(`${basePath}?${withCurrent(iso(start), iso(now))}`)
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <div className="inline-flex bg-white rounded-lg shadow-sm p-1 gap-1">
        {[
          { d: 1, l: 'اليوم' },
          { d: 7, l: '٧ أيام' },
          { d: 30, l: 'شهر' },
          { d: 90, l: '٣ شهور' },
        ].map((q) => (
          <button
            key={q.d}
            onClick={() => quick(q.d)}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {q.l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-3 py-1.5">
        <span className="text-xs text-gray-400">من</span>
        <input type="date" value={f} onChange={(e) => setF(e.target.value)} className="text-sm outline-none tabular-nums" />
        <span className="text-xs text-gray-400">إلى</span>
        <input type="date" value={t} onChange={(e) => setT(e.target.value)} className="text-sm outline-none tabular-nums" />
      </div>
      <button
        onClick={apply}
        className="flex items-center gap-1.5 bg-[#0f3460] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#0d2a4d]"
      >
        <RefreshCw className="w-4 h-4" /> تحديث
      </button>
    </div>
  )
}
