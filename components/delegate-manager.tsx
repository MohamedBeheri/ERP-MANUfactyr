'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Phone, Car, Users, KeyRound, MapPin } from 'lucide-react'

export interface DelegateRow {
  id: string
  name: string
  phone: string | null
  carNumber: string | null
  area: string | null
  route: string | null
  commissionRate: number
  totalSales: number
  commissionDue: number
  vehicleId: string | null
  vehiclePlate: string | null
  userId: string | null
  userName: string | null
}
export interface VehicleRow {
  id: string
  plateNo: string
  model: string | null
  capacity: number
  notes: string | null
  delegateNames: string[]
}
export interface UserLite {
  id: string
  name: string
  username: string
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

async function api(url: string, method: string, body?: any) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'حصل خطأ')
  return data
}

export function DelegateManager({ delegates, vehicles, users }: { delegates: DelegateRow[]; vehicles: VehicleRow[]; users: UserLite[] }) {
  const [tab, setTab] = useState<'delegates' | 'vehicles'>('delegates')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5 w-fit">
        <button onClick={() => setTab('delegates')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'delegates' ? 'bg-[#1a1a2e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Users className="w-4 h-4" /> المناديب ({delegates.length})
        </button>
        <button onClick={() => setTab('vehicles')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'vehicles' ? 'bg-[#1a1a2e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Car className="w-4 h-4" /> العربيات ({vehicles.length})
        </button>
      </div>

      {tab === 'delegates' ? (
        <DelegatesTab delegates={delegates} vehicles={vehicles} users={users} />
      ) : (
        <VehiclesTab vehicles={vehicles} />
      )}
    </div>
  )
}

/* ============ المناديب ============ */
function DelegatesTab({ delegates, vehicles, users }: { delegates: DelegateRow[]; vehicles: VehicleRow[]; users: UserLite[] }) {
  const router = useRouter()
  const empty = { name: '', phone: '', area: '', route: '', commissionRate: '5', vehicleId: '', userId: '' }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!form.name.trim()) { setError('اسم المندوب مطلوب'); return }
    try {
      await api(editId ? `/api/delegates/${editId}` : '/api/delegates', editId ? 'PUT' : 'POST', {
        ...form,
        commissionRate: Number(form.commissionRate) || 5,
        vehicleId: form.vehicleId || null,
        userId: form.userId || null,
      })
      setForm(empty); setEditId(null); router.refresh()
    } catch (err: any) { setError(err.message) }
  }

  const remove = async (d: DelegateRow) => {
    if (!confirm(`حذف المندوب "${d.name}"؟`)) return
    try { await api(`/api/delegates/${d.id}`, 'DELETE'); router.refresh() } catch (err: any) { alert(err.message) }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل مندوب' : 'مندوب جديد'}</h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم المندوب *" className={inputCls} />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="التليفون" className={inputCls} dir="ltr" />
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">العربية المسندة</label>
          <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className={inputCls}>
            <option value="">بدون عربية</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNo}{v.model ? ` — ${v.model}` : ''}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="المنطقة" className={inputCls} />
          <input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="خط السير" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">حساب دخول المندوب (لصفحته الشخصية)</label>
          <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className={inputCls}>
            <option value="">بدون حساب</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">اعمل الحساب من الحوكمة بدور «مندوب» ثم اربطه هنا.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">نسبة العمولة %</label>
          <input type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className={inputCls} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">{editId ? 'حفظ' : 'إضافة'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(empty) }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>}
        </div>
      </form>

      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-3">المناديب ({delegates.length})</h3>
        {delegates.length === 0 && <p className="text-sm text-gray-500">مفيش مناديب لسه.</p>}
        <div className="space-y-2">
          {delegates.map((d) => (
            <div key={d.id} className="flex items-start justify-between border border-gray-100 rounded-lg p-3.5 gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  {d.name}
                  {(d.vehiclePlate || d.carNumber) && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold tabular-nums flex items-center gap-1"><Car className="w-3 h-3" /> {d.vehiclePlate || d.carNumber}</span>}
                  {d.userName && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><KeyRound className="w-3 h-3" /> {d.userName}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                  {d.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3" /> {d.phone}</span>}
                  {(d.route || d.area) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {d.route || d.area}</span>}
                  <span>عمولة {d.commissionRate}%</span>
                  {d.commissionDue > 0 && <span className="text-amber-700 font-semibold tabular-nums">مستحق {d.commissionDue.toLocaleString('ar-EG')} ج.م</span>}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditId(d.id); setForm({ name: d.name, phone: d.phone || '', area: d.area || '', route: d.route || '', commissionRate: String(d.commissionRate), vehicleId: d.vehicleId || '', userId: d.userId || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(d)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============ العربيات ============ */
function VehiclesTab({ vehicles }: { vehicles: VehicleRow[] }) {
  const router = useRouter()
  const empty = { plateNo: '', model: '', capacity: '', notes: '' }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!form.plateNo.trim()) { setError('رقم اللوحة مطلوب'); return }
    try {
      await api(editId ? `/api/vehicles/${editId}` : '/api/vehicles', editId ? 'PUT' : 'POST', { ...form, capacity: Number(form.capacity) || 0 })
      setForm(empty); setEditId(null); router.refresh()
    } catch (err: any) { setError(err.message) }
  }

  const remove = async (v: VehicleRow) => {
    if (!confirm(`حذف العربية "${v.plateNo}"؟ المناديب المرتبطين هيتفكوا منها.`)) return
    try { await api(`/api/vehicles/${v.id}`, 'DELETE'); router.refresh() } catch (err: any) { alert(err.message) }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل عربية' : 'عربية جديدة'}</h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
        <input value={form.plateNo} onChange={(e) => setForm({ ...form, plateNo: e.target.value })} placeholder="أرقام وحروف اللوحة * (مثال: س م ص ٢٢١٢)" className={inputCls} />
        <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="الموديل/النوع" className={inputCls} />
        <input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="السعة التقريبية (وحدة)" className={inputCls} />
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات" className={inputCls} />
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">{editId ? 'حفظ' : 'إضافة'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(empty) }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>}
        </div>
      </form>

      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-3">العربيات ({vehicles.length})</h3>
        {vehicles.length === 0 && <p className="text-sm text-gray-500">مفيش عربيات لسه — ضيف أول عربية بأرقامها.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-start justify-between border border-gray-100 rounded-lg p-3.5 gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm flex items-center gap-1.5 tabular-nums"><Car className="w-4 h-4 text-[#0f3460]" /> {v.plateNo}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[v.model, v.capacity > 0 ? `سعة ${v.capacity}` : null].filter(Boolean).join(' · ') || '—'}
                </p>
                {v.delegateNames.length > 0 && (
                  <p className="text-[10px] text-green-700 mt-1">مسندة لـ: {v.delegateNames.join('، ')}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditId(v.id); setForm({ plateNo: v.plateNo, model: v.model || '', capacity: v.capacity ? String(v.capacity) : '', notes: v.notes || '' }) }} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(v)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
