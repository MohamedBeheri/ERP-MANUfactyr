'use client'

import { useRouter } from 'next/navigation'
import { ScrollText, CalendarClock } from 'lucide-react'

// شريط فلاتر الحوكمة: تابات (سجل المراجعة / الحضور والانصراف) + فئات العمليات + فلتر موظف
// القيم الحالية جاية من searchParams في السيرفر — المكوّن بس بيبني الرابط الجديد ويتنقل
export function GovernanceFilters({ users, categories, tab, cat, userId }: {
  users: { id: string; name: string }[]
  categories: { key: string; label: string; count: number }[]
  tab: string
  cat: string
  userId: string
}) {
  const router = useRouter()

  const push = (next: { tab?: string; cat?: string; user?: string }) => {
    const q = { tab, cat, user: userId, ...next }
    const p = new URLSearchParams()
    if (q.tab && q.tab !== 'log') p.set('tab', q.tab)
    if (q.cat) p.set('cat', q.cat)
    if (q.user) p.set('user', q.user)
    router.push(`/governance${p.toString() ? `?${p.toString()}` : ''}`)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 no-print">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        {/* التابات */}
        <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => push({ tab: 'log' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition ${tab === 'log' ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-[#1a1a2e]'}`}
          >
            <ScrollText className="w-3.5 h-3.5" /> سجل المراجعة
          </button>
          <button
            onClick={() => push({ tab: 'attendance', cat: '' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition ${tab === 'attendance' ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-[#1a1a2e]'}`}
          >
            <CalendarClock className="w-3.5 h-3.5" /> الحضور والانصراف
          </button>
        </div>

        {/* فلتر الموظف */}
        <select
          value={userId}
          onChange={(e) => push({ user: e.target.value })}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e94560] bg-white"
        >
          <option value="">كل الموظفين</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* فئات العمليات — في تاب السجل بس */}
      {tab === 'log' && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => push({ cat: cat === c.key ? '' : c.key })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                cat === c.key ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label} <span className="opacity-60 tabular-nums">({c.count.toLocaleString('ar-EG')})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
