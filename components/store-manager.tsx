'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Store, ExternalLink, Save, Package, Phone, MapPin } from 'lucide-react'

interface Settings {
  storeName: string
  tagline: string
  phone: string | null
  whatsapp: string | null
  address: string | null
  deliveryFee: number
  minOrder: number
  warehouseId: string | null
  isOpen: boolean
  showOutOfStock: boolean
  codEnabled: boolean
  accentColor: string
  bgTheme: string
  fontFamily: string
}

const ACCENT_PRESETS = ['#e9b44c', '#c9a227', '#b5651d', '#8b5e3c', '#e94560', '#16a34a', '#0f766e', '#7c3aed']
interface WarehouseLite {
  id: string
  name: string
}
interface OrderLite {
  id: string
  orderNo: string
  customerName: string
  phone: string
  address: string
  total: number
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

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

export function StoreManager({ settings, warehouses, orders, storeUrl }: { settings: Settings; warehouses: WarehouseLite[]; orders: OrderLite[]; storeUrl: string }) {
  const router = useRouter()
  const [form, setForm] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch('/api/store-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { setError('فشل الحفظ'); return }
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  const setStatus = async (id: string, status: string) => {
    if (status === 'CANCELLED' && !confirm('متأكد من إلغاء الطلب؟')) return
    const res = await fetch(`/api/online-orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || 'فشل تحديث الطلب'); return }
    router.refresh()
  }

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length

  return (
    <div className="space-y-6">
      {/* رابط المتجر */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#e94560]/10 flex items-center justify-center">
            <Store className="w-5 h-5 text-[#e94560]" />
          </div>
          <div>
            <p className="font-bold text-[#1a1a2e]">رابط موقع العميل</p>
            <p className="text-xs text-gray-500 break-all">{storeUrl}</p>
          </div>
        </div>
        <a href="/store" target="_blank" className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] text-white rounded-lg text-sm font-semibold hover:bg-[#0f3460]">
          <ExternalLink className="w-4 h-4" /> فتح المتجر
        </a>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* إعدادات المتجر */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h3 className="text-base font-bold text-[#1a1a2e]">إعدادات المتجر</h3>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          {saved && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">تم الحفظ ✓</div>}

          <label className="flex items-center justify-between text-sm font-semibold text-gray-700 cursor-pointer">
            المتجر شغّال
            <input type="checkbox" checked={form.isOpen} onChange={(e) => setForm({ ...form, isOpen: e.target.checked })} className="w-5 h-5 accent-[#e94560]" />
          </label>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">اسم المتجر</label>
            <input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">الشعار/الوصف</label>
            <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">مخزن البيع أونلاين</label>
            <select value={form.warehouseId || ''} onChange={(e) => setForm({ ...form, warehouseId: e.target.value || null })} className={inputCls}>
              <option value="">تلقائي (مخزن المنتجات)</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">رسوم التوصيل</label>
              <input type="number" min="0" step="0.01" value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: Number(e.target.value) })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">الحد الأدنى للطلب</label>
              <input type="number" min="0" step="0.01" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">التليفون</label>
              <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">واتساب</label>
              <input value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={inputCls} placeholder="201xxxxxxxxx" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">العنوان</label>
            <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.showOutOfStock} onChange={(e) => setForm({ ...form, showOutOfStock: e.target.checked })} className="w-4 h-4 accent-[#e94560]" />
            عرض المنتجات اللي نفد مخزونها
          </label>

          {/* مظهر الموقع */}
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <p className="text-sm font-bold text-[#1a1a2e]">مظهر الموقع</p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">لون الموقع الأساسي</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {ACCENT_PRESETS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, accentColor: c })} className={`w-8 h-8 rounded-lg border-2 ${form.accentColor.toLowerCase() === c.toLowerCase() ? 'border-[#1a1a2e]' : 'border-transparent'}`} style={{ backgroundColor: c }} aria-label={c} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="w-10 h-9 rounded border border-gray-200 cursor-pointer" />
                <input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className={inputCls} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">خلفية الموقع</label>
                <select value={form.bgTheme} onChange={(e) => setForm({ ...form, bgTheme: e.target.value })} className={inputCls}>
                  <option value="dark">داكن (فخم)</option>
                  <option value="light">فاتح</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">خط الموقع</label>
                <select value={form.fontFamily} onChange={(e) => setForm({ ...form, fontFamily: e.target.value })} className={inputCls}>
                  <option value="Cairo">Cairo</option>
                  <option value="Tajawal">Tajawal</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
            <Save className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>

        {/* الطلبات الأونلاين */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Package className="w-5 h-5 text-[#e94560]" />
            <h3 className="text-base font-bold text-[#1a1a2e]">طلبات الأونلاين ({orders.length})</h3>
            {pendingCount > 0 && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">{pendingCount} جديد</span>}
          </div>
          <div className="divide-y divide-gray-50 max-h-[640px] overflow-y-auto">
            {orders.length === 0 && <p className="p-6 text-sm text-gray-500 text-center">مفيش طلبات أونلاين لسه.</p>}
            {orders.map((o) => (
              <div key={o.id} className="p-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#1a1a2e] tabular-nums">{o.orderNo}</p>
                    <p className="text-sm text-gray-700 mt-0.5">{o.customerName}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5"><Phone className="w-3 h-3" /> {o.phone}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{o.address}</span></p>
                    <p className="text-xs text-gray-500 mt-1">{o.itemsText}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="font-bold text-sm tabular-nums">{fmt(o.total)} ج.م</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS[o.status]?.color}`}>
                      {STATUS[o.status]?.label}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1 tabular-nums">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>
                {NEXT[o.status]?.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {NEXT[o.status].map((n) => (
                      <button
                        key={n.to}
                        onClick={() => setStatus(o.id, n.to)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${n.to === 'CANCELLED' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-[#1a1a2e] text-white hover:bg-[#0f3460]'}`}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
