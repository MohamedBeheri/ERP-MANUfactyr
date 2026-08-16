'use client'

import { useEffect, useState, useCallback } from 'react'
import { Target, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const num = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 3 })
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

interface ProductOpt { id: string; name: string; unit: string }
interface TargetData {
  year: number; month: number
  target: null | { collectedAmountTarget: number; salesVisitsTarget: number; collectionVisitsTarget: number; notes: string | null; productLines: { productId: string; name: string; unit: string; requiredQty: number }[] }
  achievement: { collectedAmount: number; salesVisits: number; collectionVisits: number; productsSold: Record<string, number> }
  products: ProductOpt[]
}

function pct(done: number, target: number) {
  if (target <= 0) return done > 0 ? 100 : 0
  return Math.min(100, Math.round((done / target) * 100))
}
function barColor(p: number) { return p >= 100 ? 'bg-green-500' : p >= 60 ? 'bg-amber-500' : 'bg-red-500' }

function ProgressCard({ label, done, target, fmt }: { label: string; done: number; target: number; fmt: (n: number) => string }) {
  const p = pct(done, target)
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] text-gray-500">{label}</p>
        <span className={`text-xs font-bold ${p >= 100 ? 'text-green-600' : p >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{p}%</span>
      </div>
      <p className="text-lg font-bold text-[#1a1a2e] tabular-nums">{fmt(done)} <span className="text-xs font-normal text-gray-400">/ {target > 0 ? fmt(target) : '—'}</span></p>
      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor(p)}`} style={{ width: `${p}%` }} /></div>
    </div>
  )
}

export function DelegateTargetPanel({ delegateId, isAdmin = false }: { delegateId: string; isAdmin?: boolean }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<TargetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // نموذج التعديل (للأدمن)
  const [amt, setAmt] = useState('0')
  const [sv, setSv] = useState('0')
  const [cv, setCv] = useState('0')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<{ productId: string; requiredQty: string }[]>([])
  const [addId, setAddId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/delegates/${delegateId}/target?year=${year}&month=${month}`)
    const d: TargetData = await res.json()
    setData(d)
    setAmt(String(d.target?.collectedAmountTarget || 0))
    setSv(String(d.target?.salesVisitsTarget || 0))
    setCv(String(d.target?.collectionVisitsTarget || 0))
    setNotes(d.target?.notes || '')
    setLines((d.target?.productLines || []).map((l) => ({ productId: l.productId, requiredQty: String(l.requiredQty) })))
    setLoading(false)
  }, [delegateId, year, month])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setBusy(true); setError('')
    const res = await fetch(`/api/delegates/${delegateId}/target`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, collectedAmountTarget: amt, salesVisitsTarget: sv, collectionVisitsTarget: cv, notes, productLines: lines }),
    })
    setBusy(false)
    if (!res.ok) return setError((await res.json()).error || 'فشل الحفظ')
    setEditing(false); load()
  }
  const addLine = () => { if (addId && !lines.some((l) => l.productId === addId)) { setLines((p) => [...p, { productId: addId, requiredQty: '1' }]); setAddId('') } }

  const t = data?.target
  const a = data?.achievement
  const prodName = (id: string) => data?.products.find((p) => p.id === id)?.name || id
  const prodUnit = (id: string) => data?.products.find((p) => p.id === id)?.unit || ''

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0f3460]/10 flex items-center justify-center shrink-0"><Target className="w-6 h-6 text-[#0f3460]" /></div>
          <div>
            <h3 className="text-base font-bold text-[#1a1a2e]">تارجت الشهر والإنجاز</h3>
            <p className="text-xs text-gray-500 mt-0.5">الإنجاز محسوب تلقائيًا من فواتير وتحصيلات النظام</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm tabular-nums">
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {isAdmin && !editing && <button onClick={() => setEditing(true)} className="bg-[#0f3460] text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-[#0a2545] flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> تعيين التارجت</button>}
        </div>
      </div>

      {loading || !data ? (
        <p className="p-6 text-center text-gray-400 text-sm">جاري التحميل...</p>
      ) : (
        <div className="p-4 sm:p-5 space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}

          {/* شرائح الإنجاز */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ProgressCard label="المبالغ المحصّلة من البيع" done={a!.collectedAmount} target={t?.collectedAmountTarget || 0} fmt={(n) => `${money(n)} ج.م`} />
            <ProgressCard label="زيارات البيع (فواتير)" done={a!.salesVisits} target={t?.salesVisitsTarget || 0} fmt={(n) => String(n)} />
            <ProgressCard label="زيارات التحصيل" done={a!.collectionVisits} target={t?.collectionVisitsTarget || 0} fmt={(n) => String(n)} />
          </div>

          {/* الأصناف المطلوب بيعها */}
          <div>
            <h4 className="text-sm font-bold text-[#1a1a2e] mb-2 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#0f3460]" /> الأصناف المطلوب بيعها</h4>
            {(t?.productLines || []).length === 0 ? (
              <p className="text-xs text-gray-400">مفيش أصناف مستهدفة للشهر ده{isAdmin ? ' — اضغط "تعيين التارجت" لإضافتها' : ''}.</p>
            ) : (
              <div className="space-y-2">
                {t!.productLines.map((l) => {
                  const sold = a!.productsSold[l.productId] || 0
                  const p = pct(sold, l.requiredQty)
                  return (
                    <div key={l.productId} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 text-sm font-semibold text-[#1a1a2e] truncate">{l.name} <span className="text-[10px] text-gray-400 font-normal">{l.unit}</span></div>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor(p)}`} style={{ width: `${p}%` }} /></div>
                      <div className="w-32 shrink-0 text-left text-xs tabular-nums text-gray-600">{num(sold)} / {num(l.requiredQty)} <span className={`font-bold ${p >= 100 ? 'text-green-600' : 'text-gray-400'}`}>({p}%)</span></div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {t?.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5">📝 {t.notes}</p>}

          {/* نموذج التعديل للأدمن */}
          {isAdmin && editing && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h4 className="text-sm font-bold text-[#0f3460]">تعيين تارجت {MONTHS[month - 1]} {year}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="text-[11px] text-gray-500">تارجت المبالغ المحصّلة (ج.م)</label><input value={amt} onChange={(e) => setAmt(e.target.value)} dir="ltr" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums" /></div>
                <div><label className="text-[11px] text-gray-500">تارجت زيارات البيع</label><input value={sv} onChange={(e) => setSv(e.target.value)} dir="ltr" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums" /></div>
                <div><label className="text-[11px] text-gray-500">تارجت زيارات التحصيل</label><input value={cv} onChange={(e) => setCv(e.target.value)} dir="ltr" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums" /></div>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">الأصناف المطلوب بيعها</label>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={l.productId} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{prodName(l.productId)} <span className="text-[10px] text-gray-400">{prodUnit(l.productId)}</span></span>
                      <input value={l.requiredQty} onChange={(e) => setLines((p) => p.map((x, idx) => idx === i ? { ...x, requiredQty: e.target.value } : x))} dir="ltr" className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm tabular-nums" placeholder="الكمية" />
                      <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <select value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">+ إضافة صنف مستهدف...</option>
                    {data.products.filter((p) => !lines.some((l) => l.productId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={addLine} disabled={!addId} className="p-2 bg-[#0f3460] text-white rounded-lg disabled:opacity-40"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div><label className="text-[11px] text-gray-500">ملاحظات</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
              <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="bg-[#0f3460] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50">{busy ? 'جاري الحفظ...' : 'حفظ التارجت'}</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2.5 text-gray-500 text-sm">إلغاء</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
