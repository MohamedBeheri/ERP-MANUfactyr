'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Phone, MapPin, Pencil, Trash2, X, MessageCircle, PackageCheck, Star,
} from 'lucide-react'

export interface OrderRow {
  id: string
  orderNo: string
  customerName: string
  phone: string
  address: string
  notes: string | null
  subtotal: number
  deliveryFee: number
  total: number
  paymentMethod: string
  status: string
  createdAt: string
  itemsText: string
}

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'جديد', color: 'bg-yellow-50 text-yellow-700' },
  CONFIRMED: { label: 'مؤكّد', color: 'bg-blue-50 text-blue-600' },
  PREPARING: { label: 'بيتجهّز', color: 'bg-indigo-50 text-indigo-600' },
  SHIPPED: { label: 'خرج للتوصيل', color: 'bg-orange-50 text-orange-600' },
  DELIVERED: { label: 'اتسلّم', color: 'bg-green-50 text-green-600' },
  CANCELLED: { label: 'ملغي', color: 'bg-red-50 text-red-600' },
}
const NEXT: Record<string, { to: string; label: string }[]> = {
  PENDING: [{ to: 'CONFIRMED', label: 'تأكيد الطلب' }, { to: 'CANCELLED', label: 'إلغاء' }],
  CONFIRMED: [{ to: 'PREPARING', label: 'تجهيز' }, { to: 'CANCELLED', label: 'إلغاء' }],
  PREPARING: [{ to: 'SHIPPED', label: 'خرج للتوصيل' }, { to: 'CANCELLED', label: 'إلغاء' }],
  SHIPPED: [{ to: 'DELIVERED', label: 'تم التسليم' }, { to: 'CANCELLED', label: 'إلغاء' }],
  DELIVERED: [],
  CANCELLED: [],
}
const FILTERS = [
  { key: '', label: 'الكل' },
  { key: 'PENDING', label: 'جديد' },
  { key: 'CONFIRMED', label: 'مؤكّد' },
  { key: 'PREPARING', label: 'بيتجهّز' },
  { key: 'SHIPPED', label: 'في الطريق' },
  { key: 'DELIVERED', label: 'اتسلّم' },
  { key: 'CANCELLED', label: 'ملغي' },
]

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

// رسائل واتساب الجاهزة
function waUrl(phone: string, text: string) {
  const p = phone.replace(/[^0-9]/g, '')
  const intl = p.startsWith('0') ? `2${p}` : p
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
}
function confirmMsg(o: OrderRow, storeName: string) {
  return `أهلًا ${o.customerName} 👋\nمعاك ${storeName} ☕\n\nبنأكد طلبك رقم ${o.orderNo}:\n${o.itemsText}\n\nالإجمالي: ${fmt(o.total)} ج.م (${o.paymentMethod})\nالعنوان: ${o.address}\n\nهل البيانات صحيحة عشان نبدأ التجهيز؟`
}
function ratingMsg(o: OrderRow, storeName: string) {
  return `أهلًا ${o.customerName} 👋\nنتمنى إن طلبك ${o.orderNo} يكون وصلك في أحسن حال ☕\n\nيسعدنا معرفة تقييمك للمنتجات والخدمة ⭐⭐⭐⭐⭐\nردّك بيساعدنا نتحسّن دايمًا.\n\nشكرًا لثقتك في ${storeName} 🙏`
}

export function OnlineOrdersManager({ orders, storeName }: { orders: OrderRow[]; storeName: string }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<OrderRow | null>(null)
  const [form, setForm] = useState({ customerName: '', phone: '', address: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const term = q.trim()
    return orders.filter((o) => {
      if (filter && o.status !== filter) return false
      if (!term) return true
      return o.orderNo.includes(term) || o.customerName.includes(term) || o.phone.includes(term) || o.address.includes(term)
    })
  }, [orders, q, filter])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    orders.forEach((o) => { m[o.status] = (m[o.status] || 0) + 1 })
    return m
  }, [orders])

  const setStatus = async (id: string, status: string) => {
    if (status === 'CANCELLED' && !confirm('متأكد من إلغاء الطلب؟ لو كان مؤكّد هيرجع المخزون.')) return
    const res = await fetch(`/api/online-orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || 'فشل تحديث الطلب'); return }
    router.refresh()
  }

  const remove = async (o: OrderRow) => {
    if (!confirm(`حذف الطلب ${o.orderNo} نهائيًا؟ لو كان مؤكّد هيرجع المخزون.`)) return
    const res = await fetch(`/api/online-orders/${o.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || 'فشل الحذف'); return }
    router.refresh()
  }

  const startEdit = (o: OrderRow) => {
    setEditing(o)
    setForm({ customerName: o.customerName, phone: o.phone, address: o.address, notes: o.notes || '' })
    setError('')
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true); setError('')
    const res = await fetch(`/api/online-orders/${editing.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || 'فشل الحفظ'); return }
    setEditing(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* البحث والفلاتر */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث برقم الطلب أو اسم العميل أو التليفون أو العنوان..."
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === f.key ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f.label}
              <span className="mr-1 opacity-60 tabular-nums">({f.key ? counts[f.key] || 0 : orders.length})</span>
            </button>
          ))}
        </div>
      </div>

      {/* قائمة الطلبات */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500 text-sm">مفيش طلبات مطابقة.</div>
        )}
        {filtered.map((o) => (
          <div key={o.id} className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-[#1a1a2e] tabular-nums">{o.orderNo}</p>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS[o.status]?.color}`}>{STATUS[o.status]?.label}</span>
                  <span className="text-[11px] text-gray-400 tabular-nums">{new Date(o.createdAt).toLocaleString('ar-EG')}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mt-1.5">{o.customerName}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5"><Phone className="w-3 h-3" /> <span dir="ltr" className="tabular-nums">{o.phone}</span></p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0" /> {o.address}</p>
                <p className="text-xs text-gray-600 mt-1.5">{o.itemsText}</p>
                {o.notes && <p className="text-[11px] text-amber-600 mt-0.5">📝 {o.notes}</p>}
              </div>
              <div className="text-left shrink-0">
                <p className="font-black text-lg tabular-nums">{fmt(o.total)} ج.م</p>
                <p className="text-[11px] text-gray-400">💳 {o.paymentMethod}</p>
                <p className="text-[11px] text-gray-400 tabular-nums">توصيل: {fmt(o.deliveryFee)} ج.م</p>
              </div>
            </div>

            {/* الأزرار */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-50">
              {/* الحالة */}
              {NEXT[o.status]?.map((n) => (
                <button key={n.to} onClick={() => setStatus(o.id, n.to)} className={`px-3.5 py-2 rounded-lg text-xs font-bold ${n.to === 'CANCELLED' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-[#1a1a2e] text-white hover:bg-[#0f3460]'}`}>
                  {n.label}
                </button>
              ))}

              {/* تواصل واتساب */}
              {(o.status === 'PENDING' || o.status === 'CONFIRMED') && (
                <a href={waUrl(o.phone, confirmMsg(o, storeName))} target="_blank" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700">
                  <MessageCircle className="w-3.5 h-3.5" /> تأكيد مع العميل
                </a>
              )}
              {(o.status === 'SHIPPED' || o.status === 'DELIVERED') && (
                <a href={waUrl(o.phone, ratingMsg(o, storeName))} target="_blank" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600">
                  <Star className="w-3.5 h-3.5" /> طلب تقييم
                </a>
              )}
              <a href={waUrl(o.phone, `أهلًا ${o.customerName} 👋 بخصوص طلبك ${o.orderNo} من ${storeName}:\n`)} target="_blank" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-bold hover:bg-green-100">
                <MessageCircle className="w-3.5 h-3.5" /> واتساب
              </a>

              <div className="mr-auto flex gap-1">
                <button onClick={() => startEdit(o)} className="p-2 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg" aria-label="تعديل الطلب"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(o)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" aria-label="حذف الطلب"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* مودال التعديل */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1a1a2e]">تعديل الطلب {editing.orderNo}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">اسم العميل</label>
              <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">التليفون</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">العنوان</label>
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ملاحظات</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
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
