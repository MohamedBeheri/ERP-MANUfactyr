'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarRange, Plus, X, Target, Save, CheckCircle2 } from 'lucide-react'

interface DelegateLite { id: string; name: string }
interface CustomerLite { id: string; name: string; area: string | null }

// ترتيب أيام أسبوع العمل المصري — القيمة = getDay
const WEEK_DAYS: { day: number; label: string }[] = [
  { day: 6, label: 'السبت' },
  { day: 0, label: 'الأحد' },
  { day: 1, label: 'الإثنين' },
  { day: 2, label: 'الثلاثاء' },
  { day: 3, label: 'الأربعاء' },
  { day: 4, label: 'الخميس' },
  { day: 5, label: 'الجمعة' },
]

const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm bg-white'

// خط السير الأسبوعي: الأدمن بيوزّع عملاء كل مندوب على أيام الأسبوع مع تارجت أسبوعي
export function RoutePlanManager({ delegates, customers, canEdit }: {
  delegates: DelegateLite[]
  customers: CustomerLite[]
  canEdit: boolean
}) {
  const [delegateId, setDelegateId] = useState('')
  const [target, setTarget] = useState('')
  const [days, setDays] = useState<Record<number, string[]>>({})
  const [achieved, setAchieved] = useState(0)
  const [achievedIds, setAchievedIds] = useState<string[]>([])
  const [areaFilter, setAreaFilter] = useState('')
  const [search, setSearch] = useState('')
  const [addDay, setAddDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [okMsg, setOkMsg] = useState('')
  const [error, setError] = useState('')

  const customerMap = new Map(customers.map((c) => [c.id, c]))
  const areas = Array.from(new Set(customers.map((c) => c.area).filter(Boolean))) as string[]

  const loadPlan = useCallback(async (id: string) => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/delegates/${id}/route-plan`)
    setLoading(false)
    if (!res.ok) return setError('فشل تحميل الخطة')
    const data = await res.json()
    setTarget(data.weeklyCustomerTarget ? String(data.weeklyCustomerTarget) : '')
    setAchieved(data.achievedThisWeek || 0)
    setAchievedIds(data.achievedCustomerIds || [])
    const byDay: Record<number, string[]> = {}
    for (const e of data.entries) {
      if (!byDay[e.dayOfWeek]) byDay[e.dayOfWeek] = []
      byDay[e.dayOfWeek].push(e.customerId)
    }
    setDays(byDay)
  }, [])

  useEffect(() => { if (delegateId) loadPlan(delegateId) }, [delegateId, loadPlan])

  const assignedTotal = Object.values(days).reduce((s, arr) => s + arr.length, 0)
  const targetNum = parseFloat(target) || 0
  const progress = targetNum > 0 ? Math.min(100, (achieved / targetNum) * 100) : 0

  const assignedAnywhere = new Set(Object.values(days).flat())
  const addable = customers.filter((c) =>
    (!areaFilter || c.area === areaFilter) &&
    (!search.trim() || c.name.includes(search.trim()))
  )

  function addCustomer(day: number, customerId: string) {
    if (!customerId) return
    setDays((d) => {
      const list = d[day] || []
      if (list.includes(customerId)) return d
      return { ...d, [day]: [...list, customerId] }
    })
  }
  function removeCustomer(day: number, customerId: string) {
    setDays((d) => ({ ...d, [day]: (d[day] || []).filter((id) => id !== customerId) }))
  }

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/delegates/${delegateId}/route-plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeklyCustomerTarget: target, days }),
    })
    setSaving(false)
    if (!res.ok) return setError((await res.json()).error || 'فشل الحفظ')
    setOkMsg('تم حفظ خط السير والتارجت ✓')
    setTimeout(() => setOkMsg(''), 4000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden no-print">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-[#e94560]" />
          <h3 className="text-base font-bold text-[#1a1a2e]">خط السير الأسبوعي والتارجت</h3>
        </div>
        <select className={inputCls} value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
          <option value="">اختار المندوب...</option>
          {delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {!delegateId && (
        <p className="p-6 pt-2 text-sm text-gray-500">اختار مندوب عشان تحدد له التارجت الأسبوعي وتوزّع عملاءه على أيام الأسبوع.</p>
      )}

      {delegateId && !loading && (
        <div className="p-5 pt-2 space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          {okMsg && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{okMsg}</div>}

          {/* التارجت والتحقيق */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-4">
              <label className="text-[11px] font-semibold text-gray-500 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> التارجت الأسبوعي (عدد عملاء)</label>
              <input
                className={`${inputCls} w-full mt-1`}
                type="text" inputMode="decimal" dir="ltr"
                placeholder="مثلاً 200"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-gray-500">الموزّع على الخطة</p>
              <p className="text-2xl font-black tabular-nums text-[#1a1a2e] mt-1">{assignedTotal} <span className="text-xs font-normal text-gray-400">عميل/أسبوع</span></p>
              {targetNum > 0 && assignedTotal < targetNum && (
                <p className="text-[11px] text-amber-600">ناقص {targetNum - assignedTotal} عن التارجت</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> المتحقق الأسبوع ده (فواتير فعلية)</p>
              <p className="text-2xl font-black tabular-nums text-green-700 mt-1">
                {achieved}{targetNum > 0 && <span className="text-sm font-bold text-gray-400"> / {targetNum}</span>}
              </p>
              {targetNum > 0 && (
                <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : progress >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* فلاتر إضافة العملاء */}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="بحث باسم العميل..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className={inputCls} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                <option value="">كل المناطق</option>
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <span className="text-xs text-gray-400">اختار اليوم بعلامة + وبعدين دوس على العميل لإضافته</span>
            </div>
          )}

          {/* شبكة الأيام */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {WEEK_DAYS.map(({ day, label }) => {
              const list = days[day] || []
              const isAdding = addDay === day
              return (
                <div key={day} className={`rounded-xl border ${isAdding ? 'border-[#e94560] ring-2 ring-[#e94560]/20' : 'border-gray-200'} overflow-hidden flex flex-col`}>
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-sm font-bold text-[#1a1a2e]">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-white border border-gray-200 rounded-full px-1.5 py-0.5 font-bold tabular-nums">{list.length}</span>
                      {canEdit && (
                        <button onClick={() => setAddDay(isAdding ? null : day)} className={`p-1 rounded ${isAdding ? 'bg-[#e94560] text-white' : 'text-[#e94560] hover:bg-red-50'}`}>
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-2 space-y-1 min-h-[80px] max-h-64 overflow-y-auto">
                    {list.map((cid) => {
                      const c = customerMap.get(cid)
                      const done = achievedIds.includes(cid)
                      return (
                        <div key={cid} className={`flex items-center justify-between gap-1 text-xs rounded-lg px-2 py-1.5 ${done ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'}`}>
                          <span className="truncate">{done && '✓ '}{c?.name || cid}{c?.area ? <span className="text-gray-400"> · {c.area}</span> : null}</span>
                          {canEdit && (
                            <button onClick={() => removeCustomer(day, cid)} className="text-red-400 hover:text-red-600 shrink-0"><X className="w-3 h-3" /></button>
                          )}
                        </div>
                      )
                    })}
                    {list.length === 0 && <p className="text-[11px] text-gray-300 text-center pt-4">مفيش عملاء</p>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* قائمة الإضافة لليوم المحدد */}
          {canEdit && addDay !== null && (
            <div className="border border-gray-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                دوس على العميل لإضافته ليوم {WEEK_DAYS.find((w) => w.day === addDay)?.label} — {addable.length} عميل مطابق
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {addable.map((c) => {
                  const inDay = (days[addDay] || []).includes(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => addCustomer(addDay, c.id)}
                      disabled={inDay}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        inDay
                          ? 'bg-green-50 border-green-200 text-green-700 cursor-default'
                          : assignedAnywhere.has(c.id)
                            ? 'bg-blue-50 border-blue-100 text-blue-700 hover:border-blue-300'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#e94560]'
                      }`}
                    >
                      {inDay ? '✓ ' : ''}{c.name}{c.area ? ` · ${c.area}` : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {canEdit && (
            <button onClick={save} disabled={saving} className="bg-[#e94560] text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'جارٍ الحفظ...' : 'حفظ خط السير والتارجت'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
