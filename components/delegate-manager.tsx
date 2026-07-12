'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, X, MapPin, Phone, Car } from 'lucide-react'

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
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

export function DelegateManager({ delegates }: { delegates: DelegateRow[] }) {
  const router = useRouter()
  const empty = { name: '', phone: '', carNumber: '', area: '', route: '', commissionRate: '5' }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const startEdit = (d: DelegateRow) => {
    setEditId(d.id)
    setForm({
      name: d.name,
      phone: d.phone || '',
      carNumber: d.carNumber || '',
      area: d.area || '',
      route: d.route || '',
      commissionRate: String(d.commissionRate),
    })
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('اسم المندوب مطلوب')
      return
    }
    setLoading(true)
    const res = await fetch(editId ? `/api/delegates/${editId}` : '/api/delegates', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, commissionRate: Number(form.commissionRate) || 5 }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'حصل خطأ')
      return
    }
    setForm(empty)
    setEditId(null)
    setOpen(false)
    router.refresh()
  }

  const remove = async (d: DelegateRow) => {
    if (!confirm(`متأكد من حذف المندوب "${d.name}"؟`)) return
    const res = await fetch(`/api/delegates/${d.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'حصل خطأ')
      return
    }
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {delegates.map((d) => (
        <div key={d.id} className="bg-white p-5 rounded-xl shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center font-bold text-sm shrink-0">
                {d.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#1a1a2e] truncate">{d.name}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                  <Phone className="w-3 h-3 shrink-0" /> {d.phone || '—'}
                </p>
              </div>
            </div>
            <div className="flex gap-0.5 shrink-0">
              <button onClick={() => startEdit(d)} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل المندوب">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(d)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف المندوب">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-gray-500 mb-3">
            <p className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 shrink-0" />
              {d.carNumber || 'بدون عربية'} · {d.area || 'بدون منطقة'}
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              خط السير: {d.route || 'غير محدد'}
            </p>
          </div>

          <div className="space-y-1.5 text-sm border-t border-gray-50 pt-3">
            <div className="flex justify-between">
              <span className="text-gray-500">إجمالي المبيعات</span>
              <span className="font-semibold tabular-nums">{d.totalSales.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">عمولة مستحقة ({d.commissionRate}%)</span>
              <span className="font-semibold text-[#e94560] tabular-nums">{d.commissionDue.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>
        </div>
      ))}

      {/* إضافة / تعديل */}
      {open ? (
        <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3 sm:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1a1a2e]">{editId ? `تعديل: ${form.name}` : 'إضافة مندوب جديد'}</h3>
            <button type="button" onClick={() => { setOpen(false); setEditId(null); setForm(empty) }} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="اسم المندوب" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            <input type="tel" placeholder="التليفون" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            <input placeholder="رقم العربية" value={form.carNumber} onChange={(e) => setForm({ ...form, carNumber: e.target.value })} className={inputCls} />
            <input placeholder="المنطقة" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={inputCls} />
            <input placeholder="خط السير (مثال: مدينة نصر ← مصر الجديدة)" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className={`${inputCls} col-span-2`} />
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">نسبة العمولة %</label>
              <input type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className={inputCls} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
            {loading ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة المندوب'}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="min-h-40 bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-[#0f3460] hover:border-[#0f3460]/40 hover:bg-gray-50 transition-colors"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm font-semibold">إضافة مندوب جديد</span>
        </button>
      )}
    </div>
  )
}
