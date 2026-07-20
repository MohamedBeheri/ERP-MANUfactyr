'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Phone, MapPin, Pencil, Trash2, X, MessageCircle, ChevronDown, User,
  ReceiptText, Globe, Scale, Wallet,
} from 'lucide-react'

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  customerType: string
  balance: number
  totalPurchases: number
  creditLimit: number
  createdAt: string
  invoiceCount: number
  onlineCount: number
  lastOrders: { no: string; total: number; date: string; source: string }[]
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

function waUrl(phone: string) {
  const p = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${p.startsWith('0') ? `2${p}` : p}`
}

export function CustomersManager({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<CustomerRow | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '', customerType: 'RETAIL', creditLimit: '0' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const term = q.trim()
    return customers.filter((c) => {
      if (typeFilter && c.customerType !== typeFilter) return false
      if (!term) return true
      return c.name.includes(term) || (c.phone || '').includes(term) || (c.address || '').includes(term)
    })
  }, [customers, q, typeFilter])

  const startEdit = (c: CustomerRow) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', customerType: c.customerType, creditLimit: String(c.creditLimit) })
    setError('')
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true); setError('')
    const res = await fetch(`/api/customers/${editing.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, creditLimit: Number(form.creditLimit) }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || 'فشل الحفظ'); return }
    setEditing(null)
    router.refresh()
  }

  const remove = async (c: CustomerRow) => {
    if (!confirm(`حذف العميل "${c.name}"؟ الفواتير القديمة هتفضل محفوظة.`)) return
    const res = await fetch(`/api/customers/${c.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || 'فشل الحذف'); return }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* البحث */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو التليفون أو العنوان..."
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {[{ k: '', l: 'الكل' }, { k: 'RETAIL', l: 'قطاعي' }, { k: 'WHOLESALE', l: 'جملة' }].map((f) => (
            <button key={f.k} onClick={() => setTypeFilter(f.k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${typeFilter === f.k ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.l} <span className="opacity-60 tabular-nums">({f.k ? customers.filter((c) => c.customerType === f.k).length : customers.length})</span>
            </button>
          ))}
        </div>
      </div>

      {/* قائمة العملاء */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500 text-sm">مفيش عملاء مطابقين.</div>
        )}
        {filtered.map((c) => {
          const open = openId === c.id
          return (
            <div key={c.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* رأس البروفايل */}
              <button onClick={() => setOpenId(open ? null : c.id)} className="w-full flex items-center gap-4 p-4 text-right hover:bg-gray-50/60 transition">
                <div className="w-11 h-11 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center font-bold shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1a1a2e] flex items-center gap-2 flex-wrap">
                    {c.name}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.customerType === 'WHOLESALE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                      {c.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي'}
                    </span>
                    {c.balance > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 tabular-nums">مديونية {fmt(c.balance)} ج.م</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {c.phone ? <span dir="ltr" className="tabular-nums">{c.phone}</span> : 'بدون تليفون'} · {c.invoiceCount + c.onlineCount} طلب · إجمالي {fmt(c.totalPurchases)} ج.م
                  </p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {/* تفاصيل البروفايل */}
              {open && (
                <div className="border-t border-gray-50 p-5 space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat icon={<Wallet className="w-4 h-4 text-green-600" />} label="إجمالي المشتريات" value={`${fmt(c.totalPurchases)} ج.م`} />
                    <Stat icon={<Scale className="w-4 h-4 text-red-500" />} label="المديونية" value={`${fmt(c.balance)} ج.م`} danger={c.balance > 0} />
                    <Stat icon={<ReceiptText className="w-4 h-4 text-blue-600" />} label="فواتير المحل" value={String(c.invoiceCount)} />
                    <Stat icon={<Globe className="w-4 h-4 text-purple-600" />} label="طلبات الموقع" value={String(c.onlineCount)} />
                  </div>

                  {(c.phone || c.address) && (
                    <div className="text-sm text-gray-600 space-y-1">
                      {c.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> <span dir="ltr" className="tabular-nums">{c.phone}</span></p>}
                      {c.address && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400 shrink-0" /> {c.address}</p>}
                      <p className="flex items-center gap-2 text-xs text-gray-400"><User className="w-4 h-4" /> عميل من {new Date(c.createdAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                  )}

                  {/* آخر الطلبات */}
                  {c.lastOrders.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-[#1a1a2e] mb-2">آخر الطلبات</p>
                      <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg">
                        {c.lastOrders.map((o) => (
                          <div key={o.no} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${o.source === 'أونلاين' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>{o.source}</span>
                              <span className="tabular-nums truncate">{o.no}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-semibold tabular-nums">{fmt(o.total)} ج.م</span>
                              <span className="text-xs text-gray-400 tabular-nums">{new Date(o.date).toLocaleDateString('ar-EG')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* أزرار */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {c.phone && (
                      <a href={waUrl(c.phone)} target="_blank" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700">
                        <MessageCircle className="w-3.5 h-3.5" /> واتساب
                      </a>
                    )}
                    <button onClick={() => startEdit(c)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0f3460] text-white text-xs font-bold hover:bg-[#0a2545]">
                      <Pencil className="w-3.5 h-3.5" /> تعديل البيانات
                    </button>
                    <button onClick={() => remove(c)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100">
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* مودال التعديل */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1a1a2e]">تعديل: {editing.name}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">الاسم</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">التليفون</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">النوع</label>
                <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })} className={inputCls}>
                  <option value="RETAIL">قطاعي</option>
                  <option value="WHOLESALE">جملة</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">العنوان</label>
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">الحد الائتماني (للجملة)</label>
              <input type="number" min="0" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} className={inputCls} />
            </div>
            <button onClick={saveEdit} disabled={saving} className="w-full bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value, danger }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) {
  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">{icon} {label}</div>
      <p className={`font-bold tabular-nums ${danger ? 'text-red-600' : 'text-[#1a1a2e]'}`}>{value}</p>
    </div>
  )
}
