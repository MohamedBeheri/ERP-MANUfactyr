'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2, Plus, X } from 'lucide-react'

interface Customer { id: string; name: string }
interface LoadedItem { productId: string; productName: string; unit: string; sellPrice: number }

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

export function DeliveryReturnForm({
  deliveryOrderId,
  customers,
  loadedItems,
}: {
  deliveryOrderId: string
  customers: Customer[]
  loadedItems: LoadedItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [refundCash, setRefundCash] = useState(false)
  const [reason, setReason] = useState('')
  const [rows, setRows] = useState([{ productId: '', quantity: '', unitPrice: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const setRow = (i: number, f: string, v: string) => {
    setRows(rows.map((r, j) => {
      if (j !== i) return r
      if (f === 'productId') {
        const p = loadedItems.find((x) => x.productId === v)
        return { ...r, productId: v, unitPrice: p ? String(p.sellPrice) : r.unitPrice }
      }
      return { ...r, [f]: v }
    }))
  }
  const total = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const items = rows.filter((r) => r.productId && Number(r.quantity) > 0)
      .map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) || 0 }))
    if (items.length === 0) { setError('أضف صنف مرتجع واحد على الأقل'); return }
    setLoading(true)
    const res = await fetch(`/api/delivery-orders/${deliveryOrderId}/return`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: customerId || undefined, customerName: customerName || undefined, refundCash, reason, items }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setCustomerId(''); setCustomerName(''); setReason(''); setRefundCash(false); setRows([{ productId: '', quantity: '', unitPrice: '' }]); setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 text-sm">
        <Undo2 className="w-4 h-4" /> أمر مرتجع من عميل
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2"><Undo2 className="w-5 h-5 text-orange-500" /> أمر مرتجع (يرجع للعربية)</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); if (e.target.value) setCustomerName('') }} className={inputCls}>
          <option value="">اختار العميل</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="أو اسم العميل" value={customerName} onChange={(e) => { setCustomerName(e.target.value); if (e.target.value) setCustomerId('') }} className={inputCls} />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف المرتجعة</label>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <select value={r.productId} onChange={(e) => setRow(i, 'productId', e.target.value)} className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">اختار الصنف</option>
              {loadedItems.map((p) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
            </select>
            <input type="number" min="1" placeholder="كمية" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} className="w-16 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
            <input type="number" min="0" step="0.01" placeholder="سعر" value={r.unitPrice} onChange={(e) => setRow(i, 'unitPrice', e.target.value)} className="w-20 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
            {rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="shrink-0 text-red-500"><X className="w-4 h-4" /></button>}
          </div>
        ))}
        <button type="button" onClick={() => setRows([...rows, { productId: '', quantity: '', unitPrice: '' }])} className="text-sm text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة صنف</button>
      </div>

      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب المرتجع (اختياري)" className={inputCls} />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={refundCash} onChange={(e) => setRefundCash(e.target.checked)} className="w-4 h-4" />
        رد نقدي للعميل (بدل الخصم من رصيده الآجل)
      </label>

      {total > 0 && (
        <div className="flex justify-between text-sm bg-orange-50 rounded-lg p-2.5">
          <span className="text-gray-600">قيمة المرتجع</span>
          <span className="font-bold text-orange-700 tabular-nums">{fmt(total)} ج.م</span>
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50">
        {loading ? 'جاري التسجيل...' : 'تسجيل المرتجع'}
      </button>
    </form>
  )
}
