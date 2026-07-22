'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, X, AlertTriangle } from 'lucide-react'

interface RemainingItem {
  productId: string
  productName: string
  unit: string
  minKeyPrice: number
  remaining: number
}
interface KeyAccountLite {
  id: string
  name: string
  branches: { id: string; name: string }[]
  quoteItems: { productId: string; unitPrice: number }[]
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function KeyAccountSupplyForm({
  deliveryOrderId,
  remainingItems,
  keyAccounts,
}: {
  deliveryOrderId: string
  remainingItems: RemainingItem[]
  keyAccounts: KeyAccountLite[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [keyAccountId, setKeyAccountId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [discountType, setDiscountType] = useState<'NONE' | 'CASH'>('NONE')
  const [discountPercent, setDiscountPercent] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([{ productId: '', quantity: '', unitPrice: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const account = keyAccounts.find((a) => a.id === keyAccountId)
  const available = remainingItems.filter((r) => r.remaining > 0)
  const itemMap = new Map(remainingItems.map((r) => [r.productId, r]))
  const quoteMap = new Map((account?.quoteItems || []).map((q) => [q.productId, q.unitPrice]))

  const priceFor = (productId: string) => {
    const q = quoteMap.get(productId)
    if (q && q > 0) return String(q)
    const floor = itemMap.get(productId)?.minKeyPrice || 0
    return floor > 0 ? String(floor) : ''
  }

  const setRow = (i: number, f: string, v: string) => {
    setRows(rows.map((r, j) => {
      if (j !== i) return r
      if (f === 'productId') return { ...r, productId: v, unitPrice: priceFor(v) }
      return { ...r, [f]: v }
    }))
  }
  const belowFloor = (r: { productId: string; unitPrice: string }) => {
    const floor = itemMap.get(r.productId)?.minKeyPrice || 0
    return floor > 0 && r.unitPrice !== '' && Number(r.unitPrice) < floor
  }
  const overStock = (r: { productId: string; quantity: string }) => {
    const rem = itemMap.get(r.productId)?.remaining ?? 0
    return r.quantity !== '' && Number(r.quantity) > rem
  }

  const subtotal = rows.reduce((s, r) => s + (Number(r.unitPrice) || 0) * (Number(r.quantity) || 0), 0)
  const cashDisc = discountType === 'CASH' ? (subtotal * (Number(discountPercent) || 0)) / 100 : 0
  const net = subtotal - cashDisc

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!keyAccountId || !branchId) { setError('اختار العميل والفرع'); return }
    const items = rows.filter((r) => r.productId && Number(r.quantity) > 0 && Number(r.unitPrice) >= 0)
      .map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) }))
    if (items.length === 0) { setError('أضف صنف واحد على الأقل'); return }
    if (rows.some(belowFloor)) { setError('في سعر أقل من الحد الأدنى لكبار الموردين'); return }
    if (rows.some(overStock)) { setError('في كمية أكبر من المتبقي على العربية'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/delivery-orders/${deliveryOrderId}/supply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyAccountId, branchId, items, discountType, discountPercent: Number(discountPercent) || 0, notes }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'حصل خطأ'); setLoading(false); return }
      setRows([{ productId: '', quantity: '', unitPrice: '' }]); setBranchId(''); setDiscountType('NONE'); setDiscountPercent(''); setNotes('')
      setLoading(false)
      router.refresh()
    } catch { setError('حصل خطأ'); setLoading(false) }
  }

  if (keyAccounts.length === 0) return null

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-xl font-semibold hover:bg-amber-600 text-sm">
        <Building2 className="w-4 h-4" /> توريد لفرع كبار موردين
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2"><Building2 className="w-5 h-5 text-amber-600" /> توريد لفرع كبار موردين</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={keyAccountId} onChange={(e) => { setKeyAccountId(e.target.value); setBranchId('') }} className={inputCls}>
          <option value="">اختار العميل (المقر)</option>
          {keyAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!account} className={`${inputCls} disabled:bg-gray-100`}>
          <option value="">اختار الفرع</option>
          {(account?.branches || []).map((br) => <option key={br.id} value={br.id}>{br.name}</option>)}
        </select>
      </div>
      {account && account.branches.length === 0 && (
        <p className="text-xs text-amber-600">العميل ده ملوش فروع — ضيف فروع من قسم كبار الموردين الأول.</p>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف (من المتبقي على العربية)</label>
        {rows.map((r, i) => {
          const low = belowFloor(r); const over = overStock(r); const rem = itemMap.get(r.productId)?.remaining ?? 0
          return (
            <div key={i} className="space-y-0.5">
              <div className="flex gap-2">
                <select value={r.productId} onChange={(e) => setRow(i, 'productId', e.target.value)} className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">اختار الصنف</option>
                  {available.map((p) => <option key={p.productId} value={p.productId}>{p.productName} (متبقي {p.remaining})</option>)}
                </select>
                <input type="number" min="1" placeholder="كمية" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} className={`w-16 shrink-0 px-2 py-2 border rounded-lg text-sm tabular-nums ${over ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                <input type="number" min="0" step="0.01" placeholder="سعر" value={r.unitPrice} onChange={(e) => setRow(i, 'unitPrice', e.target.value)} className={`w-20 shrink-0 px-2 py-2 border rounded-lg text-sm tabular-nums ${low ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                {rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="shrink-0 text-red-500"><X className="w-4 h-4" /></button>}
              </div>
              {r.productId && (low || over) && (
                <p className="text-[10px] text-red-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {low && `أقل من الحد الأدنى (${fmt(itemMap.get(r.productId)?.minKeyPrice || 0)}) `}{over && `الكمية أكبر من المتبقي (${rem})`}
                </p>
              )}
            </div>
          )
        })}
        <button type="button" onClick={() => setRows([...rows, { productId: '', quantity: '', unitPrice: '' }])} className="text-xs text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة صنف</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)} className={inputCls}>
          <option value="NONE">بدون خصم</option>
          <option value="CASH">خصم نقدي (مصر فلوس)</option>
        </select>
        <input type="number" min="0" max="100" step="0.5" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} disabled={discountType === 'NONE'} className={`${inputCls} disabled:bg-gray-100`} placeholder="نسبة %" />
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className={inputCls} />

      {subtotal > 0 && (
        <div className="bg-gray-50 rounded-lg p-2.5 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">الإجمالي</span><span className="font-semibold tabular-nums">{fmt(subtotal)} ج.م</span></div>
          {cashDisc > 0 && <div className="flex justify-between text-red-600"><span>خصم نقدي {discountPercent}%</span><span className="font-semibold tabular-nums">−{fmt(cashDisc)} ج.م</span></div>}
          <div className="flex justify-between border-t border-gray-100 pt-1 text-sm"><span className="font-bold">مطالبة على المقر</span><span className="font-bold text-amber-700 tabular-nums">{fmt(net)} ج.م</span></div>
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-amber-500 text-white py-2.5 rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50 text-sm">
        {loading ? 'جاري التسجيل...' : 'تسجيل التوريد'}
      </button>
    </form>
  )
}
