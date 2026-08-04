'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Users, MapPin } from 'lucide-react'

// فلاتر تقرير المناديب: مندوب واحد أو الجميع + منطقة معينة أو الكل — مع الحفاظ على المدة
export function DelegateReportFilters({
  delegates,
  areas,
  currentDelegateId,
  currentArea,
}: {
  delegates: { id: string; name: string }[]
  areas: string[]
  currentDelegateId?: string
  currentArea?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const go = (delegateId: string, area: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (area) params.set('area', area)
    else params.delete('area')
    const base = delegateId ? `/finance/delegates/${delegateId}` : '/finance/delegates'
    router.push(`${base}?${params.toString()}`)
  }

  const selectCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30'

  return (
    <div className="no-print bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-[#0f3460]" />
        <span className="text-xs font-semibold text-gray-500">المندوب:</span>
        <select
          className={selectCls}
          value={currentDelegateId || ''}
          onChange={(e) => go(e.target.value, currentArea || '')}
        >
          <option value="">الجميع (تقرير مجمّع)</option>
          {delegates.map((d) => <option key={d.id} value={d.id}>{d.name} — تقرير مفصّل</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-[#e94560]" />
        <span className="text-xs font-semibold text-gray-500">المنطقة:</span>
        <select
          className={selectCls}
          value={currentArea || ''}
          onChange={(e) => go(currentDelegateId || '', e.target.value)}
        >
          <option value="">كل المناطق</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {(currentDelegateId || currentArea) && (
        <button onClick={() => go('', '')} className="text-xs text-gray-400 hover:text-gray-600 underline mr-auto">
          إلغاء الفلاتر — عرض الجميع
        </button>
      )}
    </div>
  )
}
