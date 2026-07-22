'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Plus, X } from 'lucide-react'

interface Customer {
  id: string
  name: string
  tierId: string | null
  tierName: string | null
}
interface RemainingItem {
  productId: string
  productName: string
  unit: string
  sellPrice: number
  remaining: number
}
interface RewardRuleLite {
  productId: string
  buyQuantity: number
  freeProductId: string
  freeQuantity: number
  repeat: boolean
  tierId: string | null
}

const PAY_METHODS = ['نقدي فوري', 'آجل', 'نقدي جزئي'] as const

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function DeliverForm({
  deliveryOrderId,
  customers,
  remainingItems,
  rewardRules = [],
  delegateArea = null,
}: {
  deliveryOrderId: string
  customers: Customer[]
  remainingItems: RemainingItem[]
  rewardRules?: RewardRuleLite[]
  delegateArea?: string | null
}) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [payMethod, setPayMethod] = useState<(typeof PAY_METHODS)[number]>('نقدي فوري')
  const [paidAmount, setPaidAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([{ productId: '', quantity: '', unitPrice: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedCustomer = customers.find((c) => c.id === customerId) || null
  const productName = new Map(remainingItems.map((r) => [r.productId, r.productName]))
  const unitOf = new Map(remainingItems.map((r) => [r.productId, r.unit]))
  const availableItems = remainingItems.filter((item) => item.remaining > 0)

  const addRow = () => setRows([...rows, { productId: '', quantity: '', unitPrice: '' }])
  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i))
  const updateRow = (i: number, field: 'productId' | 'quantity' | 'unitPrice', value: string) => {
    setRows(rows.map((row, j) => {
      if (j !== i) return row
      if (field === 'productId') {
        const p = remainingItems.find((x) => x.productId === value)
        return { ...row, productId: value, unitPrice: p ? String(p.sellPrice) : row.unitPrice }
      }
      return { ...row, [field]: value }
    }))
  }

  const netAmount = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0)

  // معاينة البونص لحظيًا حسب فئة العميل (نفس منطق السيرفر)
  const bonusPreview = useMemo(() => {
    const tierId = selectedCustomer?.tierId ?? null
    const qtyByProduct = new Map<string, number>()
    rows.forEach((r) => {
      if (r.productId && Number(r.quantity) > 0) qtyByProduct.set(r.productId, (qtyByProduct.get(r.productId) || 0) + Number(r.quantity))
    })
    const merged = new Map<string, number>()
    for (const rule of rewardRules) {
      if (rule.tierId && rule.tierId !== tierId) continue
      if (rule.buyQuantity <= 0 || rule.freeQuantity <= 0) continue
      const bought = qtyByProduct.get(rule.productId) || 0
      if (bought < rule.buyQuantity) continue
      const times = rule.repeat ? Math.floor(bought / rule.buyQuantity) : 1
      const free = times * rule.freeQuantity
      if (free > 0) merged.set(rule.freeProductId, (merged.get(rule.freeProductId) || 0) + free)
    }
    return Array.from(merged.entries()).map(([pid, qty]) => ({ productId: pid, quantity: qty }))
  }, [rows, selectedCustomer, rewardRules])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    let finalCustomerId = customerId
    const items = rows
      .filter((r) => r.productId && r.quantity && r.unitPrice)
      .map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) }))

    if ((!customerId && !newCustomerName) || items.length === 0) {
      setError('اختار عميل أو اكتب اسم عميل جديد، وصنف واحد على الأقل')
      return
    }
    if (payMethod === 'نقدي جزئي' && !(Number(paidAmount) > 0)) {
      setError('اكتب المبلغ المدفوع في الدفع الجزئي')
      return
    }
    setLoading(true)

    if (!finalCustomerId && newCustomerName) {
      const cRes = await fetch('/api/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName, area: delegateArea || undefined }),
      })
      const cData = await cRes.json()
      if (!cRes.ok) { setLoading(false); setError(cData.error || 'حصل خطأ في إضافة العميل'); return }
      finalCustomerId = cData.id
    }

    const res = await fetch(`/api/delivery-orders/${deliveryOrderId}/deliver`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: finalCustomerId, items, paymentMethod: payMethod,
        paidAmount: payMethod === 'نقدي جزئي' ? Number(paidAmount) : undefined,
        notes: notes || undefined,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }

    setCustomerId(''); setNewCustomerName(''); setPayMethod('نقدي فوري'); setPaidAmount(''); setNotes('')
    setRows([{ productId: '', quantity: '', unitPrice: '' }])
    router.refresh()
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <h3 className="text-base font-bold text-[#1a1a2e]">تنزيل بضاعة لعميل</h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          العميل {delegateArea ? <span className="text-xs font-normal text-gray-400">(نطاق: {delegateArea})</span> : null}
        </label>
        <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); if (e.target.value) setNewCustomerName('') }} className={`${inputCls} mb-2`}>
          <option value="">اختار عميل من نطاقك</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.tierName ? ` — ${c.tierName}` : ''}</option>
          ))}
        </select>
        <input placeholder="أو اكتب اسم عميل جديد" value={newCustomerName} onChange={(e) => { setNewCustomerName(e.target.value); if (e.target.value) setCustomerId('') }} className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">طريقة الدفع</label>
        <div className="flex gap-1.5">
          {PAY_METHODS.map((m) => (
            <button key={m} type="button" onClick={() => setPayMethod(m)} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition ${payMethod === m ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600'}`}>{m}</button>
          ))}
        </div>
        {payMethod === 'نقدي جزئي' && (
          <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="المبلغ المدفوع دلوقتي" className={`${inputCls} mt-2`} />
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف</label>
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <select value={row.productId} onChange={(e) => updateRow(i, 'productId', e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">اختار الصنف</option>
              {availableItems.map((p) => <option key={p.productId} value={p.productId}>{p.productName} (متبقي {p.remaining} {p.unit})</option>)}
            </select>
            <input type="number" min="1" placeholder="كمية" value={row.quantity} onChange={(e) => updateRow(i, 'quantity', e.target.value)} className="w-16 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
            <input type="number" min="0" step="0.01" placeholder="سعر" value={row.unitPrice} onChange={(e) => updateRow(i, 'unitPrice', e.target.value)} className="w-20 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
            {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="shrink-0 text-red-500"><X className="w-4 h-4" /></button>}
          </div>
        ))}
        <button type="button" onClick={addRow} className="text-sm text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة صنف</button>
      </div>

      {/* معاينة البونص لحظيًا */}
      {bonusPreview.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5 mb-1"><Gift className="w-4 h-4" /> هدية مستحقة للعميل (هتتضاف تلقائيًا للفاتورة)</p>
          {bonusPreview.map((b) => (
            <p key={b.productId} className="text-xs text-amber-800">🎁 {b.quantity} {unitOf.get(b.productId) || ''} {productName.get(b.productId) || 'صنف'}</p>
          ))}
        </div>
      )}

      {netAmount > 0 && (
        <div className="flex justify-between text-sm bg-gray-50 rounded-lg p-2.5">
          <span className="text-gray-500">إجمالي الفاتورة</span>
          <span className="font-bold tabular-nums">{fmt(netAmount)} ج.م</span>
        </div>
      )}

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات على الفاتورة (اختياري)" rows={2} className={inputCls} />

      <button type="submit" disabled={loading} className="w-full bg-[#0f3460] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50">
        {loading ? 'جاري التسليم...' : 'تسجيل التسليم'}
      </button>
    </form>
  )
}
