'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Phone, MapPin, Pencil, Trash2, X, MessageCircle, User, Plus,
  ReceiptText, Globe, Scale, Wallet, Star, Building2, Eye, Printer, FileDown,
} from 'lucide-react'
import { EGYPT_GOVERNORATES } from '@/lib/governorates'
import { LocationPicker, LocationPreview, type GeoPoint } from '@/components/location-picker'

export interface OrderDetail {
  id: string
  no: string
  total: number
  paid: number | null
  remaining: number | null
  date: string
  source: string
  paymentType: string | null
  paymentMethod: string
  statusLabel: string
  statusTone: string
  items: { name: string; qty: number; unit: string }[]
  printHref: string | null
}

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  area: string | null
  governorate: string | null
  lat: number | null
  lng: number | null
  customerType: string
  tierId: string | null
  tierName: string | null
  bonusPoints: number
  balance: number
  totalPurchases: number
  creditLimit: number
  createdAt: string
  invoiceCount: number
  onlineCount: number
  lastOrders: OrderDetail[]
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const emptyForm = { name: '', phone: '', address: '', area: '', governorate: '', customerType: 'RETAIL', tierId: '', creditLimit: '0' }

function waUrl(phone: string) {
  const p = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${p.startsWith('0') ? `2${p}` : p}`
}

export function CustomersManager({ customers, tiers = [], canAdd = true, canEdit = true, canDelete = true }: { customers: CustomerRow[]; tiers?: { id: string; name: string }[]; canAdd?: boolean; canEdit?: boolean; canDelete?: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [viewing, setViewing] = useState<CustomerRow | null>(null)
  const [editing, setEditing] = useState<CustomerRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [geo, setGeo] = useState<GeoPoint | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const term = q.trim()
    return customers.filter((c) => {
      if (typeFilter && c.customerType !== typeFilter) return false
      if (!term) return true
      return c.name.includes(term) || (c.phone || '').includes(term) || (c.address || '').includes(term) || (c.area || '').includes(term)
    })
  }, [customers, q, typeFilter])

  const startAdd = () => {
    setForm(emptyForm)
    setGeo(null)
    setError('')
    setAdding(true)
  }

  const startEdit = (c: CustomerRow) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', area: c.area || '', governorate: c.governorate || '', customerType: c.customerType, tierId: c.tierId || '', creditLimit: String(c.creditLimit) })
    setGeo(c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null)
    setError('')
  }

  const createCustomer = async () => {
    if (!form.name.trim()) { setError('اسم العميل مطلوب'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, creditLimit: Number(form.creditLimit), lat: geo?.lat, lng: geo?.lng }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || 'فشل إضافة العميل'); return }
    setAdding(false)
    router.refresh()
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true); setError('')
    const res = await fetch(`/api/customers/${editing.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, creditLimit: Number(form.creditLimit), lat: geo?.lat, lng: geo?.lng }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || 'فشل الحفظ'); return }
    setEditing(null)
    router.refresh()
  }

  const redeem = async (c: CustomerRow) => {
    const val = prompt(`رصيد بونص "${c.name}": ${fmt(c.bonusPoints)} نقطة\nاكتب عدد النقاط اللي هتستبدلها:`)
    if (!val) return
    const res = await fetch(`/api/customers/${c.id}/redeem`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: Number(val) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || 'فشل الاستبدال'); return }
    router.refresh()
  }

  const convertToKey = async (c: CustomerRow) => {
    if (!confirm(`تحويل "${c.name}" إلى قسم كبار الموردين؟ هيتنقل رصيده ويتعطّل حسابه هنا.`)) return
    const res = await fetch(`/api/customers/${c.id}/convert-to-key-account`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || 'فشل التحويل'); return }
    alert('تم التحويل. هتلاقيه في قسم كبار الموردين.')
    router.push('/key-accounts')
  }

  const remove = async (c: CustomerRow) => {
    if (!confirm(`حذف العميل "${c.name}"؟ الفواتير القديمة هتفضل محفوظة.`)) return
    const res = await fetch(`/api/customers/${c.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || 'فشل الحذف'); return }
    router.refresh()
  }

  const formBody = (
    <>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">الاسم *</label>
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
        <label className="block text-xs font-semibold text-gray-500 mb-1">فئة العميل (التسعير والبونص)</label>
        <select value={form.tierId} onChange={(e) => setForm({ ...form, tierId: e.target.value })} className={inputCls}>
          <option value="">بدون فئة</option>
          {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">العنوان</label>
        <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">المنطقة / خط السير (لفلترة عملاء المندوب)</label>
        <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="مثال: القاهرة الجديدة" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">المحافظة (لخريطة العملاء)</label>
        <select value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value })} className={inputCls}>
          <option value="">بدون محافظة</option>
          {EGYPT_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">موقع العميل الجغرافي</label>
        <LocationPicker value={geo} onChange={setGeo} label="تسجيل موقعي الحالي كموقع العميل" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">الحد الائتماني (للجملة)</label>
        <input type="text" inputMode="decimal" dir="ltr" min="0" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} className={inputCls} />
      </div>
    </>
  )

  return (
    <div className="space-y-4">
      {/* البحث والفلاتر */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو التليفون أو المنطقة..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
            />
          </div>
          {canAdd && (
            <button onClick={startAdd} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#e94560] text-white text-sm font-bold hover:bg-[#d13350] shrink-0">
              <Plus className="w-4 h-4" /> إضافة عميل جديد
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {[{ k: '', l: 'الكل' }, { k: 'RETAIL', l: 'قطاعي' }, { k: 'WHOLESALE', l: 'جملة' }].map((f) => (
            <button key={f.k} onClick={() => setTypeFilter(f.k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${typeFilter === f.k ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.l} <span className="opacity-60 tabular-nums">({f.k ? customers.filter((c) => c.customerType === f.k).length : customers.length})</span>
            </button>
          ))}
        </div>
      </div>

      {/* جدول العملاء */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">مفيش عملاء مطابقين.</div>
        ) : (
          <>
            {/* بطاقات الموبايل */}
            <div className="sm:hidden divide-y divide-gray-50">
              {filtered.map((c) => (
                <div key={c.id} className="p-4 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-xs font-bold shrink-0">{c.name.charAt(0)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#1a1a2e] truncate">{c.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${c.customerType === 'WHOLESALE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                          {c.tierName || (c.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي')}
                        </span>
                        {c.bonusPoints > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold tabular-nums">🎁 {fmt(c.bonusPoints)}</span>}
                        {c.balance > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-bold tabular-nums">مديونية {fmt(c.balance)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    {c.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" /> <span dir="ltr" className="tabular-nums">{c.phone}</span></p>}
                    {(c.governorate || c.area) && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {[c.governorate, c.area].filter(Boolean).join(' — ')}</p>}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => setViewing(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-bold"><Eye className="w-3.5 h-3.5" /> عرض</button>
                    <a href={`/print/customer-statement/${c.id}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-bold"><FileDown className="w-3.5 h-3.5" /> PDF</a>
                    {canEdit && <button onClick={() => startEdit(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 text-[#0f3460] text-xs font-bold"><Pencil className="w-3.5 h-3.5" /> تعديل</button>}
                    {canDelete && <button onClick={() => remove(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold"><Trash2 className="w-3.5 h-3.5" /> حذف</button>}
                  </div>
                </div>
              ))}
            </div>

            {/* جدول الديسكتوب */}
            <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
                  <th className="p-3 font-medium">الاسم</th>
                  <th className="p-3 font-medium">النوع</th>
                  <th className="p-3 font-medium">المنطقة</th>
                  <th className="p-3 font-medium">التليفون</th>
                  <th className="p-3 font-medium no-print"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-xs font-bold shrink-0">{c.name.charAt(0)}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1a1a2e] truncate">{c.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {c.bonusPoints > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold tabular-nums">🎁 {fmt(c.bonusPoints)}</span>}
                            {c.balance > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-bold tabular-nums">مديونية {fmt(c.balance)}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${c.customerType === 'WHOLESALE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                        {c.tierName || (c.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي')}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">
                      {c.governorate || c.area ? (
                        <span className="flex items-center gap-1 text-xs whitespace-nowrap">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {[c.governorate, c.area].filter(Boolean).join(' — ')}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="p-3 text-gray-600">
                      {c.phone ? <span dir="ltr" className="tabular-nums text-xs">{c.phone}</span> : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="p-3 no-print">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => setViewing(c)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#0f3460]" title="عرض التفاصيل" aria-label="عرض التفاصيل"><Eye className="w-4 h-4" /></button>
                        <a href={`/print/customer-statement/${c.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#e94560]" title="استخراج PDF" aria-label="استخراج PDF"><FileDown className="w-4 h-4" /></a>
                        {canEdit && <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-[#0f3460]" title="تعديل" aria-label="تعديل"><Pencil className="w-4 h-4" /></button>}
                        {canDelete && <button onClick={() => remove(c)} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600" title="حذف" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* مودال عرض التفاصيل */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setViewing(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1a1a2e] flex items-center gap-2 flex-wrap">
                {viewing.name}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${viewing.customerType === 'WHOLESALE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                  {viewing.tierName || (viewing.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي')}
                </span>
              </h3>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Stat icon={<Wallet className="w-4 h-4 text-green-600" />} label="إجمالي المشتريات" value={`${fmt(viewing.totalPurchases)} ج.م`} />
              <Stat icon={<Scale className="w-4 h-4 text-red-500" />} label="المديونية" value={`${fmt(viewing.balance)} ج.م`} danger={viewing.balance > 0} />
              <Stat icon={<ReceiptText className="w-4 h-4 text-blue-600" />} label="فواتير المحل" value={String(viewing.invoiceCount)} />
              <Stat icon={<Globe className="w-4 h-4 text-purple-600" />} label="طلبات الموقع" value={String(viewing.onlineCount)} />
              <Stat icon={<Star className="w-4 h-4 text-amber-500" />} label="رصيد البونص" value={`${fmt(viewing.bonusPoints)} نقطة`} />
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              {viewing.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> <span dir="ltr" className="tabular-nums">{viewing.phone}</span></p>}
              {(viewing.governorate || viewing.area || viewing.address) && (
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400 shrink-0" /> {[viewing.governorate, viewing.area, viewing.address].filter(Boolean).join(' — ')}</p>
              )}
              <p className="flex items-center gap-2 text-xs text-gray-400"><User className="w-4 h-4" /> عميل من {new Date(viewing.createdAt).toLocaleDateString('ar-EG')}</p>
            </div>

            {viewing.lat != null && viewing.lng != null && (
              <div>
                <p className="text-sm font-bold text-[#1a1a2e] mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#e94560]" /> موقع العميل الجغرافي</p>
                <LocationPreview lat={viewing.lat} lng={viewing.lng} height={180} />
              </div>
            )}

            {viewing.lastOrders.length > 0 && (
              <div>
                <p className="text-sm font-bold text-[#1a1a2e] mb-2">تفاصيل الطلبات والدفع (آخر {viewing.lastOrders.length})</p>
                <div className="space-y-2">
                  {viewing.lastOrders.map((o) => (
                    <div key={o.id} className="border border-gray-100 rounded-lg p-3 text-sm space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${o.source === 'أونلاين' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>{o.source}</span>
                          <span className="tabular-nums font-semibold truncate">{o.no}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                            o.statusTone === 'green' ? 'bg-green-50 text-green-700' : o.statusTone === 'amber' ? 'bg-amber-50 text-amber-700' : o.statusTone === 'red' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                          }`}>{o.statusLabel}</span>
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums shrink-0">{new Date(o.date).toLocaleDateString('ar-EG')}</span>
                      </div>

                      {o.items.length > 0 && (
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {o.items.map((it) => `${it.name} ×${fmt(it.qty)}${it.unit ? ` ${it.unit}` : ''}`).join(' · ')}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-gray-50">
                        <span className="text-xs text-gray-500">
                          {o.paymentType ? `${o.paymentType} — ` : ''}{o.paymentMethod}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          {o.paid != null && o.remaining != null && o.remaining > 0 && (
                            <span className="text-[11px] text-amber-700 tabular-nums">متبقي {fmt(o.remaining)} ج.م</span>
                          )}
                          <span className="font-bold tabular-nums text-[#1a1a2e]">{fmt(o.total)} ج.م</span>
                          {o.printHref && (
                            <a href={o.printHref} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#0f3460]" title="طباعة الفاتورة" aria-label="طباعة الفاتورة">
                              <Printer className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {viewing.phone && (
                <a href={waUrl(viewing.phone)} target="_blank" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700">
                  <MessageCircle className="w-3.5 h-3.5" /> واتساب
                </a>
              )}
              <a href={`/print/customer-statement/${viewing.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e94560] text-white text-xs font-bold hover:bg-[#d13350]">
                <FileDown className="w-3.5 h-3.5" /> استخراج PDF
              </a>
              {viewing.bonusPoints > 0 && (
                <button onClick={() => redeem(viewing)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600">
                  <Star className="w-3.5 h-3.5" /> استبدال بونص
                </button>
              )}
              {canEdit && (
                <button onClick={() => { const c = viewing; setViewing(null); startEdit(c) }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0f3460] text-white text-xs font-bold hover:bg-[#0a2545]">
                  <Pencil className="w-3.5 h-3.5" /> تعديل البيانات
                </button>
              )}
              {canEdit && (
                <button onClick={() => convertToKey(viewing)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100">
                  <Building2 className="w-3.5 h-3.5" /> تحويل لكبار موردين
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال إضافة عميل جديد */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAdding(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1a1a2e]">إضافة عميل جديد</h3>
              <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>
            {formBody}
            <button onClick={createCustomer} disabled={saving} className="w-full bg-[#e94560] text-white py-2.5 rounded-lg font-semibold hover:bg-[#d13350] disabled:opacity-50 text-sm">
              {saving ? 'جاري الإضافة...' : 'إضافة العميل'}
            </button>
          </div>
        </div>
      )}

      {/* مودال التعديل */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1a1a2e]">تعديل: {editing.name}</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>
            {formBody}
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
