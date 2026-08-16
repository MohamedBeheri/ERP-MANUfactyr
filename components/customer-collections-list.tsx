'use client'

import { useState, useMemo } from 'react'
import { Wallet, Search, Phone, MapPin } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })

interface Row { id: string; name: string; phone: string | null; area: string | null; routeName: string | null; balance: number; lastCollectionAt: string | null }

// شاشة "تحصيلات العملاء" للمندوب: كل عميل عليه قد إيه + بحث
export function CustomerCollectionsList({ rows, title = 'تحصيلات العملاء' }: { rows: Row[]; title?: string }) {
  const [search, setSearch] = useState('')
  const list = useMemo(() => {
    const q = search.trim()
    const filtered = q ? rows.filter((r) => r.name.includes(q) || (r.phone || '').includes(q) || (r.area || '').includes(q)) : rows
    return [...filtered].sort((a, b) => b.balance - a.balance)
  }, [rows, search])
  const totalDue = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
  const withDebt = rows.filter((r) => r.balance > 0).length

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Wallet className="w-6 h-6 text-amber-700" /></div>
          <div>
            <h3 className="text-base font-bold text-[#1a1a2e]">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">إجمالي المديونية {money(totalDue)} ج.م · {withDebt} عميل عليه مديونية</p>
          </div>
        </div>
        <div className="relative w-full sm:w-60">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن عميل..." className="w-full pr-9 pl-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
      </div>
      {list.length === 0 ? (
        <p className="p-6 text-center text-gray-400 text-sm">مفيش عملاء</p>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 sm:px-5">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#1a1a2e] truncate">{r.name}{r.routeName ? <span className="mr-1 text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-normal">{r.routeName}</span> : null}</p>
                <p className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">{r.phone && <span className="inline-flex items-center gap-0.5"><Phone className="w-3 h-3" />{r.phone}</span>}{r.area && <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{r.area}</span>}{r.lastCollectionAt && <span>آخر تحصيل {new Date(r.lastCollectionAt).toLocaleDateString('ar-EG')}</span>}</p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${r.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>{money(r.balance)} ج.م</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
