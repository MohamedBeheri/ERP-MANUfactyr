'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays } from 'lucide-react'

const PRESETS = [
  { days: 1, label: 'اليوم' },
  { days: 7, label: '7 أيام' },
  { days: 14, label: '14 يوم' },
  { days: 30, label: '30 يوم' },
]

export function PeriodSelector({ current, basePath }: { current: number; basePath: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const fromVal = params.get('from') || ''
  const toVal = params.get('to') || ''

  const push = (q: Record<string, string>) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(q)) if (v) sp.set(k, v)
    router.push(`${basePath}?${sp.toString()}`)
  }

  return (
    <div className="no-print flex flex-col items-end gap-2">
      <div className="inline-flex bg-white/10 backdrop-blur rounded-lg p-1 gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => push({ days: String(p.days) })}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              current === p.days && !fromVal
                ? 'bg-white text-[#1a1a2e]'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-white/50" />
        <input
          type="date"
          defaultValue={fromVal}
          onChange={e => push({ from: e.target.value, to: toVal || new Date().toISOString().slice(0, 10) })}
          className="bg-white/10 backdrop-blur text-white text-xs rounded-md px-2 py-1.5 border-0 outline-none [color-scheme:dark]"
        />
        <span className="text-white/40 text-xs">إلى</span>
        <input
          type="date"
          defaultValue={toVal}
          onChange={e => push({ from: fromVal || '2024-01-01', to: e.target.value })}
          className="bg-white/10 backdrop-blur text-white text-xs rounded-md px-2 py-1.5 border-0 outline-none [color-scheme:dark]"
        />
      </div>
    </div>
  )
}
