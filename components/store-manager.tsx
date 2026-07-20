'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Store, ExternalLink, Save, Package, Phone, MapPin, Settings2, CreditCard,
  Share2, Palette, FileText, Images as ImagesIcon,
} from 'lucide-react'
import { CollapseSection } from '@/components/collapse-section'

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
  cardEnabled: boolean
  heroInterval: number
  heroMotion: string
  accentColor: string
  bgTheme: string
  fontFamily: string
  promoText: string | null
  promoLink: string | null
  aboutTitle: string | null
  aboutText: string | null
  facebook: string | null
  instagram: string | null
  email: string | null
}

const ACCENT_PRESETS = ['#e9b44c', '#c9a227', '#b5651d', '#8b5e3c', '#e94560', '#16a34a', '#0f766e', '#7c3aed']

interface WarehouseLite { id: string; name: string }
interface OrderLite {
  id: string; orderNo: string; customerName: string; phone: string; address: string
  total: number; status: string; createdAt: string; itemsText: string; paymentMethod: string
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

  const SaveBar = () => (
    <div className="flex items-center gap-3 pt-3">
      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
        <Save className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : 'حفظ'}
      </button>
      {saved && <span className="text-sm text-green-600 font-semibold">تم الحفظ ✓</span>}
      {error && <span className="text-sm text-red-600 font-semibold">{error}</span>}
    </div>
  )

  return (
    <div className="space-y-4">
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

      {/* 1) طلبات الموقع */}
      <CollapseSection
        title="طلبات الموقع"
        subtitle="متابعة الطلبات الأونلاين وتغيير حالتها"
        icon={<Package className="w-5 h-5 text-[#e94560]" />}
        badge={pendingCount}
        defaultOpen={pendingCount > 0}
      >
        <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto -mx-1 px-1">
          {orders.length === 0 && <p className="py-6 text-sm text-gray-500 text-center">مفيش طلبات أونلاين لسه.</p>}
          {orders.map((o) => (
            <div key={o.id} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[#1a1a2e] tabular-nums">{o.orderNo}</p>
                  <p className="text-sm text-gray-700 mt-0.5">{o.customerName}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5"><Phone className="w-3 h-3" /> {o.phone}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{o.address}</span></p>
                  <p className="text-xs text-gray-500 mt-1">{o.itemsText}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">💳 {o.paymentMethod}</p>
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
                    <button key={n.to} onClick={() => setStatus(o.id, n.to)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${n.to === 'CANCELLED' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-[#1a1a2e] text-white hover:bg-[#0f3460]'}`}>
                      {n.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapseSection>

      {/* 2) الإعدادات العامة */}
      <CollapseSection title="الإعدادات العامة" subtitle="تشغيل المتجر، الاسم، المخزن، التوصيل" icon={<Settings2 className="w-5 h-5 text-[#0f3460]" />}>
        <div className="space-y-3 pt-3">
          <label className="flex items-center justify-between text-sm font-semibold text-gray-700 cursor-pointer">
            المتجر شغّال
            <input type="checkbox" checked={form.isOpen} onChange={(e) => setForm({ ...form, isOpen: e.target.checked })} className="w-5 h-5 accent-[#e94560]" />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.showOutOfStock} onChange={(e) => setForm({ ...form, showOutOfStock: e.target.checked })} className="w-4 h-4 accent-[#e94560]" />
            عرض المنتجات اللي نفد مخزونها
          </label>
          <SaveBar />
        </div>
      </CollapseSection>

      {/* 3) طرق الدفع */}
      <CollapseSection title="طرق الدفع" subtitle="تحكم في طرق الدفع المتاحة للعميل" icon={<CreditCard className="w-5 h-5 text-green-600" />}>
        <div className="space-y-3 pt-3">
          <label className="flex items-center justify-between text-sm font-semibold text-gray-700 cursor-pointer border border-gray-100 rounded-xl p-3.5">
            <span className="flex items-center gap-2">💵 الدفع عند الاستلام</span>
            <input type="checkbox" checked={form.codEnabled} onChange={(e) => setForm({ ...form, codEnabled: e.target.checked })} className="w-5 h-5 accent-green-600" />
          </label>
          <label className="flex items-center justify-between text-sm font-semibold text-gray-700 cursor-pointer border border-gray-100 rounded-xl p-3.5">
            <span className="flex items-center gap-2">💳 الدفع بالفيزا</span>
            <input type="checkbox" checked={form.cardEnabled} onChange={(e) => setForm({ ...form, cardEnabled: e.target.checked })} className="w-5 h-5 accent-blue-600" />
          </label>
          {!form.codEnabled && !form.cardEnabled && (
            <p className="text-xs text-red-500">لازم طريقة دفع واحدة على الأقل تكون مفعّلة.</p>
          )}
          <SaveBar />
        </div>
      </CollapseSection>

      {/* 4) إعدادات البانر */}
      <CollapseSection title="حركة البانر (السلايدر)" subtitle="زمن التحرك ونوع الحركة بين الشرائح" icon={<ImagesIcon className="w-5 h-5 text-[#0f3460]" />}>
        <div className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">زمن التحرك (ثواني)</label>
              <input type="number" min="2" max="30" value={form.heroInterval} onChange={(e) => setForm({ ...form, heroInterval: Number(e.target.value) })} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-1">كل كام ثانية ينتقل لشريحة جديدة (2-30)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">حركة الانتقال</label>
              <select value={form.heroMotion} onChange={(e) => setForm({ ...form, heroMotion: e.target.value })} className={inputCls}>
                <option value="slide">انزلاق ناعم (Slide)</option>
                <option value="fade">تلاشي (Fade)</option>
              </select>
            </div>
          </div>
          <SaveBar />
        </div>
      </CollapseSection>

      {/* 5) التواصل والسوشيال */}
      <CollapseSection title="التواصل والسوشيال" subtitle="تليفون، واتساب، عنوان، فيسبوك، انستجرام، إيميل" icon={<Share2 className="w-5 h-5 text-sky-600" />}>
        <div className="space-y-3 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">التليفون</label>
              <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">واتساب</label>
              <input value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={inputCls} placeholder="201xxxxxxxxx" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">فيسبوك</label>
              <input value={form.facebook || ''} onChange={(e) => setForm({ ...form, facebook: e.target.value })} className={inputCls} dir="ltr" placeholder="https://facebook.com/..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">انستجرام</label>
              <input value={form.instagram || ''} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className={inputCls} dir="ltr" placeholder="https://instagram.com/..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">الإيميل</label>
              <input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} dir="ltr" type="email" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">العنوان</label>
              <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
            </div>
          </div>
          <SaveBar />
        </div>
      </CollapseSection>

      {/* 6) مظهر الموقع */}
      <CollapseSection title="مظهر الموقع" subtitle="اللون الأساسي، الخلفية، الخط" icon={<Palette className="w-5 h-5 text-purple-600" />}>
        <div className="space-y-3 pt-3">
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
          <SaveBar />
        </div>
      </CollapseSection>

      {/* 7) محتوى الموقع */}
      <CollapseSection title="محتوى الموقع" subtitle="شريط العرض الترويجي وقصة العلامة" icon={<FileText className="w-5 h-5 text-orange-500" />}>
        <div className="space-y-3 pt-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">شريط العرض الترويجي (يظهر تحت البانر)</label>
            <input value={form.promoText || ''} onChange={(e) => setForm({ ...form, promoText: e.target.value })} placeholder="مثال: اطلب بـ 1200ج واحصل على هدية" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">عنوان قصة العلامة</label>
            <input value={form.aboutTitle || ''} onChange={(e) => setForm({ ...form, aboutTitle: e.target.value })} placeholder="مثال: من أكتر من 30 سنة..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">نص قصة العلامة</label>
            <textarea value={form.aboutText || ''} onChange={(e) => setForm({ ...form, aboutText: e.target.value })} rows={3} className={`${inputCls} resize-none`} />
          </div>
          <SaveBar />
        </div>
      </CollapseSection>
    </div>
  )
}
