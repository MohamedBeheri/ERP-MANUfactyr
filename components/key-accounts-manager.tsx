'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Plus, X, ChevronDown, MapPin, Phone, Pencil, Trash2, Store,
  FileText, Printer, Tag, AlertTriangle,
} from 'lucide-react'

interface ProductLite {
  id: string
  name: string
  unit: string
  wholesalePrice: number
  minKeyPrice: number
}
interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  manager: string | null
}
interface Quote {
  id: string
  quoteNo: string
  status: string
  discountType: string
  discountPercent: number
  adminExpenses: number
  createdAt: string
  itemsCount: number
  subtotal: number
}
interface Account {
  id: string
  name: string
  brandName: string | null
  activityType: string | null
  phone: string | null
  address: string | null
  balance: number
  totalPurchases: number
  notes: string | null
  branches: Branch[]
  quotes: Quote[]
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'مسودة', cls: 'bg-gray-100 text-gray-600' },
  APPROVED: { label: 'معتمد', cls: 'bg-green-50 text-green-600' },
  CANCELLED: { label: 'ملغي', cls: 'bg-red-50 text-red-600' },
}

async function api(url: string, method: string, body?: any) {
  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'حصل خطأ')
  return data
}

export function KeyAccountsManager({ accounts, products }: { accounts: Account[]; products: ProductLite[] }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const emptyAcc = { name: '', brandName: '', activityType: '', phone: '', address: '' }
  const [accForm, setAccForm] = useState(emptyAcc)
  const [editAccId, setEditAccId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const submitAcc = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    try {
      await api(editAccId ? `/api/key-accounts/${editAccId}` : '/api/key-accounts', editAccId ? 'PUT' : 'POST', accForm)
      setAccForm(emptyAcc); setShowAdd(false); setEditAccId(null); router.refresh()
    } catch (e: any) { setErr(e.message) }
  }
  const removeAcc = async (a: Account) => {
    if (!confirm(`حذف "${a.name}"؟`)) return
    try { await api(`/api/key-accounts/${a.id}`, 'DELETE'); router.refresh() } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setShowAdd(!showAdd); setEditAccId(null); setAccForm(emptyAcc) }} className="flex items-center gap-2 bg-[#0f3460] text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-[#0a2545] text-sm">
          <Plus className="w-4 h-4" /> عميل كبار موردين جديد
        </button>
      </div>

      {(showAdd || editAccId) && (
        <form onSubmit={submitAcc} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
          <h3 className="text-base font-bold text-[#1a1a2e]">{editAccId ? 'تعديل العميل' : 'بيانات العميل'}</h3>
          {err && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{err}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">اسم العميل *</label>
              <input value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">اسم الماركة التجارية</label>
              <input value={accForm.brandName} onChange={(e) => setAccForm({ ...accForm, brandName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">نوع النشاط</label>
              <input value={accForm.activityType} onChange={(e) => setAccForm({ ...accForm, activityType: e.target.value })} placeholder="مثال: بيت جملة / سوبر ماركت" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">رقم الهاتف</label>
              <input value={accForm.phone} onChange={(e) => setAccForm({ ...accForm, phone: e.target.value })} className={inputCls} dir="ltr" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">عنوان المقر الرئيسي</label>
              <input value={accForm.address} onChange={(e) => setAccForm({ ...accForm, address: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">{editAccId ? 'حفظ' : 'إضافة'}</button>
            <button type="button" onClick={() => { setShowAdd(false); setEditAccId(null); setAccForm(emptyAcc) }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>
          </div>
        </form>
      )}

      {accounts.length === 0 && !showAdd && (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500 text-sm">مفيش عملاء كبار موردين لسه. ضيف أول عميل.</div>
      )}

      <div className="space-y-3">
        {accounts.map((a) => {
          const open = openId === a.id
          return (
            <div key={a.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button onClick={() => setOpenId(open ? null : a.id)} className="w-full flex items-center gap-4 p-4 text-right hover:bg-gray-50/60 transition">
                <div className="w-11 h-11 rounded-full bg-[#0f3460] text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1a1a2e] flex items-center gap-2 flex-wrap">
                    {a.name}
                    {a.brandName && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">{a.brandName}</span>}
                    {a.balance > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 tabular-nums">مطالبات {fmt(a.balance)} ج.م</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {a.activityType || 'بدون نشاط'} · {a.branches.length} فرع · {a.quotes.length} بيان سعر
                  </p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="border-t border-gray-50 p-5 space-y-5">
                  {/* بيانات المقر */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                    {a.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" /> <span dir="ltr">{a.phone}</span></span>}
                    {a.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {a.address}</span>}
                    <button onClick={() => { setEditAccId(a.id); setShowAdd(false); setAccForm({ name: a.name, brandName: a.brandName || '', activityType: a.activityType || '', phone: a.phone || '', address: a.address || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex items-center gap-1 text-[#0f3460] font-medium hover:underline"><Pencil className="w-3.5 h-3.5" /> تعديل</button>
                    <button onClick={() => removeAcc(a)} className="flex items-center gap-1 text-red-500 font-medium hover:underline"><Trash2 className="w-3.5 h-3.5" /> حذف</button>
                  </div>

                  <BranchesSection account={a} />
                  <QuotesSection account={a} products={products} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============ الفروع ============ */
function BranchesSection({ account }: { account: Account }) {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const empty = { name: '', address: '', phone: '', manager: '' }
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    try {
      if (editId) await api(`/api/key-account-branches/${editId}`, 'PUT', form)
      else await api('/api/key-account-branches', 'POST', { ...form, keyAccountId: account.id })
      setForm(empty); setShow(false); setEditId(null); router.refresh()
    } catch (e: any) { setErr(e.message) }
  }
  const remove = async (b: Branch) => {
    if (!confirm(`حذف فرع "${b.name}"؟`)) return
    try { await api(`/api/key-account-branches/${b.id}`, 'DELETE'); router.refresh() } catch (e: any) { alert(e.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-1.5"><Store className="w-4 h-4 text-[#e94560]" /> فروع البيع ({account.branches.length})</h4>
        <button onClick={() => { setShow(!show); setEditId(null); setForm(empty) }} className="text-xs text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة فرع</button>
      </div>

      {(show || editId) && (
        <form onSubmit={submit} className="bg-gray-50 p-3 rounded-lg space-y-2 mb-2">
          {err && <div className="bg-red-50 text-red-600 p-2 rounded text-xs">{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الفرع *" className={inputCls} />
            <input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder="مسؤول الفرع" className={inputCls} />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="تليفون" className={inputCls} dir="ltr" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="العنوان" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-[#0f3460] text-white px-4 py-1.5 rounded-lg text-xs font-semibold">{editId ? 'حفظ' : 'إضافة'}</button>
            <button type="button" onClick={() => { setShow(false); setEditId(null); setForm(empty) }} className="px-3 py-1.5 bg-gray-200 rounded-lg text-xs">إلغاء</button>
          </div>
        </form>
      )}

      {account.branches.length === 0 ? (
        <p className="text-xs text-gray-400">مفيش فروع مضافة.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {account.branches.map((b) => (
            <div key={b.id} className="border border-gray-100 rounded-lg p-2.5 flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{b.name}</p>
                <p className="text-[11px] text-gray-400">{[b.manager, b.phone, b.address].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                <button onClick={() => { setEditId(b.id); setShow(false); setForm({ name: b.name, address: b.address || '', phone: b.phone || '', manager: b.manager || '' }) }} className="p-1 text-gray-400 hover:text-[#0f3460]" aria-label="تعديل"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(b)} className="p-1 text-gray-400 hover:text-red-600" aria-label="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============ بيانات الأسعار ============ */
function QuotesSection({ account, products }: { account: Account; products: ProductLite[] }) {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [rows, setRows] = useState([{ productId: '', quantity: '', unitPrice: '' }])
  const [discountType, setDiscountType] = useState<'NONE' | 'CASH'>('NONE')
  const [discountPercent, setDiscountPercent] = useState('')
  const [adminExpenses, setAdminExpenses] = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const pMap = new Map(products.map((p) => [p.id, p]))
  const setRow = (i: number, f: string, v: string) => {
    setRows(rows.map((r, j) => {
      if (j !== i) return r
      if (f === 'productId') {
        const p = pMap.get(v)
        return { ...r, productId: v, unitPrice: p && p.minKeyPrice > 0 ? String(p.minKeyPrice) : r.unitPrice }
      }
      return { ...r, [f]: v }
    }))
  }
  const belowFloor = (r: { productId: string; unitPrice: string }) => {
    const p = pMap.get(r.productId)
    return p && p.minKeyPrice > 0 && r.unitPrice !== '' && Number(r.unitPrice) < p.minKeyPrice
  }

  const subtotal = rows.reduce((s, r) => s + (Number(r.unitPrice) || 0) * (Number(r.quantity) || 0), 0)
  const admin = Number(adminExpenses) || 0
  const cashDisc = discountType === 'CASH' ? ((subtotal + admin) * (Number(discountPercent) || 0)) / 100 : 0
  const net = subtotal + admin - cashDisc

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    const items = rows.filter((r) => r.productId && Number(r.unitPrice) > 0)
      .map((r) => ({ productId: r.productId, quantity: Number(r.quantity) || 0, unitPrice: Number(r.unitPrice) }))
    if (items.length === 0) { setErr('أضف صنف واحد على الأقل بسعر'); return }
    if (rows.some(belowFloor)) { setErr('في سعر أقل من الحد الأدنى لكبار الموردين — صحّحه'); return }
    setLoading(true)
    try {
      const q = await api('/api/price-quotes', 'POST', {
        keyAccountId: account.id, items, discountType,
        discountPercent: Number(discountPercent) || 0, adminExpenses: admin, notes,
      })
      setRows([{ productId: '', quantity: '', unitPrice: '' }]); setDiscountType('NONE'); setDiscountPercent(''); setAdminExpenses(''); setNotes(''); setShow(false)
      router.refresh()
      window.open(`/print/price-quote/${q.id}`, '_blank')
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-1.5"><FileText className="w-4 h-4 text-[#0f3460]" /> بيانات الأسعار ({account.quotes.length})</h4>
        <button onClick={() => setShow(!show)} className="text-xs text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> بيان سعر جديد</button>
      </div>

      {show && (
        <form onSubmit={submit} className="bg-gray-50 p-3 rounded-lg space-y-2.5 mb-3">
          {err && <div className="bg-red-50 text-red-600 p-2 rounded text-xs">{err}</div>}
          <p className="text-[11px] text-gray-500">السعر يدوي بالكامل، بس ممنوع يقل عن الحد الأدنى المحدد للمنتج لكبار الموردين.</p>
          {rows.map((r, i) => {
            const p = pMap.get(r.productId)
            const low = belowFloor(r)
            return (
              <div key={i} className="space-y-1">
                <div className="flex gap-2">
                  <select value={r.productId} onChange={(e) => setRow(i, 'productId', e.target.value)} className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">اختار الصنف</option>
                    {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                  </select>
                  <input type="number" min="0" placeholder="كمية" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} className="w-16 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
                  <input type="number" min="0" step="0.01" placeholder="سعر" value={r.unitPrice} onChange={(e) => setRow(i, 'unitPrice', e.target.value)} className={`w-20 shrink-0 px-2 py-2 border rounded-lg text-sm tabular-nums ${low ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                  {rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="shrink-0 text-red-500"><X className="w-4 h-4" /></button>}
                </div>
                {p && p.minKeyPrice > 0 && (
                  <p className={`text-[10px] flex items-center gap-1 ${low ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                    {low && <AlertTriangle className="w-3 h-3" />} الحد الأدنى: {fmt(p.minKeyPrice)} ج.م {p.wholesalePrice > 0 ? `· جملة ${fmt(p.wholesalePrice)}` : ''}
                  </p>
                )}
              </div>
            )
          })}
          <button type="button" onClick={() => setRows([...rows, { productId: '', quantity: '', unitPrice: '' }])} className="text-xs text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة صنف</button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">نوع الخصم</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)} className={inputCls}>
                <option value="NONE">بدون خصم</option>
                <option value="CASH">خصم نقدي (مصر فلوس)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">نسبة الخصم %</label>
              <input type="number" min="0" max="100" step="0.5" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} disabled={discountType === 'NONE'} className={`${inputCls} disabled:bg-gray-100`} placeholder="25" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">مصاريف إدارية تُحمّل على البيان (ج.م)</label>
              <input type="number" min="0" step="0.01" value={adminExpenses} onChange={(e) => setAdminExpenses(e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className={inputCls} />

          {subtotal > 0 && (
            <div className="bg-white rounded-lg p-2.5 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">إجمالي الأصناف</span><span className="font-semibold tabular-nums">{fmt(subtotal)} ج.م</span></div>
              {admin > 0 && <div className="flex justify-between"><span className="text-gray-500">مصاريف إدارية</span><span className="font-semibold tabular-nums">+{fmt(admin)} ج.م</span></div>}
              {cashDisc > 0 && <div className="flex justify-between text-red-600"><span>خصم نقدي {discountPercent}%</span><span className="font-semibold tabular-nums">−{fmt(cashDisc)} ج.م</span></div>}
              <div className="flex justify-between border-t border-gray-100 pt-1 text-sm"><span className="font-bold">الصافي</span><span className="font-bold text-green-700 tabular-nums">{fmt(net)} ج.م</span></div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-[#0f3460] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{loading ? 'جاري الحفظ...' : 'حفظ وطباعة البيان'}</button>
            <button type="button" onClick={() => setShow(false)} className="px-3 py-2 bg-gray-200 rounded-lg text-sm">إلغاء</button>
          </div>
        </form>
      )}

      {account.quotes.length === 0 ? (
        <p className="text-xs text-gray-400">مفيش بيانات أسعار لسه.</p>
      ) : (
        <div className="space-y-1.5">
          {account.quotes.map((q) => (
            <div key={q.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-sm flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[#0f3460]" /> {q.quoteNo}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS[q.status]?.cls}`}>{STATUS[q.status]?.label}</span>
                </p>
                <p className="text-[11px] text-gray-400 tabular-nums">
                  {q.itemsCount} صنف · {fmt(q.subtotal)} ج.م{q.discountType === 'CASH' ? ` · خصم نقدي ${q.discountPercent}%` : ''}
                </p>
              </div>
              <a href={`/print/price-quote/${q.id}`} target="_blank" className="p-2 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg" aria-label="طباعة"><Printer className="w-4 h-4" /></a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
