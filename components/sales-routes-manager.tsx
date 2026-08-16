'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Route, Plus, Pencil, Trash2, X } from 'lucide-react'

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

interface RouteRow { id: string; name: string; notes: string | null; dayOfWeek: number | null; delegateId: string | null; delegateName: string | null; customersCount: number }
interface DelegateOpt { id: string; name: string }

export function SalesRoutesManager({ routes, delegates }: { routes: RouteRow[]; delegates: DelegateOpt[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('')
  const [delegateId, setDelegateId] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setEditId(null); setName(''); setDayOfWeek(''); setDelegateId(''); setNotes(''); setError('') }
  const startEdit = (r: RouteRow) => { setEditId(r.id); setName(r.name); setDayOfWeek(r.dayOfWeek == null ? '' : String(r.dayOfWeek)); setDelegateId(r.delegateId || ''); setNotes(r.notes || ''); setOpen(true) }

  const save = async () => {
    if (!name.trim()) return setError('اسم خط السير مطلوب')
    setBusy(true); setError('')
    const res = await fetch(editId ? `/api/sales-routes/${editId}` : '/api/sales-routes', {
      method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, dayOfWeek, delegateId, notes }),
    })
    setBusy(false)
    if (!res.ok) return setError((await res.json()).error || 'فشل الحفظ')
    reset(); setOpen(false); router.refresh()
  }
  const remove = async (r: RouteRow) => {
    if (!confirm(`حذف خط السير "${r.name}"؟ العملاء المرتبطين هيتفكّوا منه.`)) return
    const res = await fetch(`/api/sales-routes/${r.id}`, { method: 'DELETE' })
    if (!res.ok) return alert((await res.json()).error || 'فشل الحذف')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0"><Route className="w-6 h-6 text-indigo-600" /></div>
          <div>
            <h3 className="text-base font-bold text-[#1a1a2e]">خطوط السير ونطاقات العربيات ({routes.length})</h3>
            <p className="text-xs text-gray-500 mt-0.5">اربط كل نطاق بمندوب ويوم، وحدّد عملاءه من شاشة العملاء</p>
          </div>
        </div>
        <button onClick={() => { reset(); setOpen(true) }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center gap-1.5"><Plus className="w-4 h-4" /> نطاق جديد</button>
      </div>

      {open && (
        <div className="p-4 sm:p-5 bg-gray-50/60 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-[#1a1a2e]">{editId ? 'تعديل نطاق' : 'نطاق جديد'}</h4><button onClick={() => { reset(); setOpen(false) }} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button></div>
          {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-[11px] text-gray-500">اسم خط السير / النطاق</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: نطاق شرق — عربية ١" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="text-[11px] text-gray-500">المندوب المسؤول</label><select value={delegateId} onChange={(e) => setDelegateId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"><option value="">— بدون —</option>{delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="text-[11px] text-gray-500">يوم الزيارة (اختياري)</label><select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"><option value="">— بدون —</option>{DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></div>
            <div><label className="text-[11px] text-gray-500">ملاحظات</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
          </div>
          <button onClick={save} disabled={busy} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50">{busy ? 'جاري...' : 'حفظ'}</button>
        </div>
      )}

      {routes.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">مفيش خطوط سير — ابدأ بإضافة نطاق</p> : (
        <div className="divide-y divide-gray-50">
          {routes.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 sm:px-5">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#1a1a2e]">{r.name} <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-normal tabular-nums">{r.customersCount} عميل</span></p>
                <p className="text-[11px] text-gray-400">{r.delegateName || 'بدون مندوب'}{r.dayOfWeek != null ? ` · ${DAYS[r.dayOfWeek]}` : ''}{r.notes ? ` · ${r.notes}` : ''}</p>
              </div>
              <button onClick={() => startEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
