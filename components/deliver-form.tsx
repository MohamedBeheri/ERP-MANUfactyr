'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Plus, X, UserPlus, Percent, Star } from 'lucide-react'

interface TierLite { priceSource: string; discountPercent: number; bonusPercent: number }
interface Customer {
  id: string
  name: string
  tierId: string | null
  tierName: string | null
  customerType: 'RETAIL' | 'WHOLESALE'
  tier: TierLite | null
}
interface RemainingItem {
  productId: string
  productName: string
  unit: string
  sellPrice: number
  wholesalePrice: number
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

// نفس منطق السيرفر (lib/tiers.customerUnitPrice) — سعر الصنف حسب فئة/نوع العميل
function priceFor(cust: { customerType?: string | null; tier: TierLite | null } | null, item: RemainingItem): number {
  const source = cust?.tier?.priceSource ?? (cust?.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL')
  const base = source === 'WHOLESALE' && item.wholesalePrice > 0 ? item.wholesalePrice : item.sellPrice
  const disc = cust?.tier ? cust.tier.discountPercent : 0
  return Math.max(0, +(base * (1 - disc / 100)).toFixed(2))
}

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
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [customerId, setCustomerId] = useState('')
  // بيانات العميل الجديد
  const [nc, setNc] = useState({ name: '', phone: '', address: '', activityType: '', customerType: 'RETAIL' as 'RETAIL' | 'WHOLESALE' })
  const [payMethod, setPayMethod] = useState<(typeof PAY_METHODS)[number]>('نقدي فوري')
  const [paidAmount, setPaidAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([{ productId: '', quantity: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedCustomer = customers.find((c) => c.id === customerId) || null
  // العميل الفعّال لحساب السعر (موجود أو مسودّة عميل جديد)
  const activeCustomer = mode === 'existing'
    ? selectedCustomer
    : { customerType: nc.customerType, tier: null }
  const activeTierId = mode === 'existing' ? (selectedCustomer?.tierId ?? null) : null

  const itemOf = new Map(remainingItems.map((r) => [r.productId, r]))
  const productName = new Map(remainingItems.map((r) => [r.productId, r.productName]))
  const unitOf = new Map(remainingItems.map((r) => [r.productId, r.unit]))
  const availableItems = remainingItems.filter((item) => item.remaining > 0)

  const addRow = () => setRows([...rows, { productId: '', quantity: '' }])
  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i))
  const updateRow = (i: number, field: 'productId' | 'quantity', value: string) =>
    setRows(rows.map((row, j) => (j === i ? { ...row, [field]: value } : row)))

  // سطور مسعّرة تلقائيًا حسب العميل
  const pricedRows = rows.map((r) => {
    const item = r.productId ? itemOf.get(r.productId) || null : null
    const unitPrice = item ? (activeCustomer ? priceFor(activeCustomer, item) : item.sellPrice) : 0
    const basePrice = item ? item.sellPrice : 0
    const qty = Number(r.quantity) || 0
    return { ...r, unitPrice, basePrice, qty, lineTotal: qty * unitPrice, saving: Math.max(0, (basePrice - unitPrice) * qty) }
  })

  const netAmount = pricedRows.reduce((s, r) => s + r.lineTotal, 0)
  const totalSaving = pricedRows.reduce((s, r) => s + r.saving, 0)
  const tierDiscountPct = activeCustomer?.tier?.discountPercent || 0
  const bonusPct = activeCustomer?.tier?.bonusPercent || 0
  const pointsEarned = bonusPct > 0 ? +((netAmount * bonusPct) / 100).toFixed(2) : 0

  // معاينة الهدايا (اشترِ X خُد Y) حسب فئة العميل
  const bonusPreview = useMemo(() => {
    const qtyByProduct = new Map<string, number>()
    rows.forEach((r) => {
      if (r.productId && Number(r.quantity) > 0) qtyByProduct.set(r.productId, (qtyByProduct.get(r.productId) || 0) + Number(r.quantity))
    })
    const merged = new Map<string, number>()
    for (const rule of rewardRules) {
      if (rule.tierId && rule.tierId !== activeTierId) continue
      if (rule.buyQuantity <= 0 || rule.freeQuantity <= 0) continue
      const bought = qtyByProduct.get(rule.productId) || 0
      if (bought < rule.buyQuantity) continue
      const times = rule.repeat ? Math.floor(bought / rule.buyQuantity) : 1
      const free = times * rule.freeQuantity
      if (free > 0) merged.set(rule.freeProductId, (merged.get(rule.freeProductId) || 0) + free)
    }
    return Array.from(merged.entries()).map(([pid, qty]) => ({ productId: pid, quantity: qty }))
  }, [rows, activeTierId, rewardRules])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const items = pricedRows
      .filter((r) => r.productId && r.qty > 0)
      .map((r) => ({ productId: r.productId, quantity: r.qty }))

    if (mode === 'existing' && !customerId) return setError('اختار العميل الأول')
    if (mode === 'new' && !nc.name.trim()) return setError('اكتب اسم العميل الجديد')
    if (items.length === 0) return setError('اختار صنف واحد على الأقل')
    if (payMethod === 'نقدي جزئي' && !(Number(paidAmount) > 0)) return setError('اكتب المبلغ المدفوع في الدفع الجزئي')

    setLoading(true)
    let finalCustomerId = customerId

    if (mode === 'new') {
      const cRes = await fetch('/api/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nc.name.trim(), phone: nc.phone.trim() || undefined, address: nc.address.trim() || undefined,
          activityType: nc.activityType.trim() || undefined, customerType: nc.customerType, area: delegateArea || undefined,
        }),
      })
      const cData = await cRes.json()
      if (!cRes.ok) { setLoading(false); return setError(cData.error || 'حصل خطأ في إضافة العميل') }
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
    if (!res.ok) return setError(data.error || 'حصل خطأ')

    setCustomerId(''); setMode('existing'); setNc({ name: '', phone: '', address: '', activityType: '', customerType: 'RETAIL' })
    setPayMethod('نقدي فوري'); setPaidAmount(''); setNotes(''); setRows([{ productId: '', quantity: '' }])
    router.refresh()
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
  const priceSourceLabel = activeCustomer?.tier?.priceSource === 'WHOLESALE' || activeCustomer?.customerType === 'WHOLESALE' ? 'سعر جملة' : 'سعر قطاعي'

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <h3 className="text-base font-bold text-[#1a1a2e]">تنزيل بضاعة لعميل</h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      {/* اختيار العميل: موجود أو جديد */}
      <div>
        <div className="flex gap-1.5 mb-2">
          <button type="button" onClick={() => setMode('existing')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition ${mode === 'existing' ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600'}`}>عميل موجود</button>
          <button type="button" onClick={() => setMode('new')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${mode === 'new' ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600'}`}><UserPlus className="w-3.5 h-3.5" /> عميل جديد</button>
        </div>

        {mode === 'existing' ? (
          <>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              العميل {delegateArea ? <span className="text-xs font-normal text-gray-400">(نطاق: {delegateArea})</span> : null}
            </label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">اختار عميل من نطاقك</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.tierName ? ` — ${c.tierName}` : c.customerType === 'WHOLESALE' ? ' — جملة' : ''}</option>
              ))}
            </select>
            {selectedCustomer && (
              <p className="text-xs text-gray-500 mt-1">
                {priceSourceLabel}{tierDiscountPct > 0 ? ` · خصم فئة ${tierDiscountPct}%` : ''}{bonusPct > 0 ? ` · بونص ${bonusPct}%` : ''}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
            <input placeholder="اسم العميل *" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="رقم التليفون" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} className={inputCls} inputMode="tel" />
              <input placeholder="نوع النشاط (كافيه/سوبر ماركت)" value={nc.activityType} onChange={(e) => setNc({ ...nc, activityType: e.target.value })} className={inputCls} />
            </div>
            <input placeholder="العنوان" value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} className={inputCls} />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">نوع العميل (بيحدد السعر)</label>
              <div className="flex gap-1.5">
                {(['RETAIL', 'WHOLESALE'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setNc({ ...nc, customerType: t })} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition ${nc.customerType === t ? 'bg-[#0f3460] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                    {t === 'RETAIL' ? 'قطاعي' : 'جملة'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* طريقة الدفع */}
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

      {/* الأصناف — السعر بيظهر تلقائي حسب العميل، المندوب ما بيكتبش سعر */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف <span className="text-xs font-normal text-gray-400">(السعر تلقائي حسب العميل)</span></label>
        {pricedRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={row.productId} onChange={(e) => updateRow(i, 'productId', e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">اختار الصنف</option>
              {availableItems.map((p) => <option key={p.productId} value={p.productId}>{p.productName} (متبقي {p.remaining} {p.unit})</option>)}
            </select>
            <input type="number" min="1" placeholder="كمية" value={row.quantity} onChange={(e) => updateRow(i, 'quantity', e.target.value)} className="w-16 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
            <div className="w-24 shrink-0 text-center bg-gray-50 rounded-lg py-2 px-1">
              {row.productId ? (
                <>
                  <span className="block text-sm font-bold tabular-nums text-[#0f3460]">{fmt(row.unitPrice)}</span>
                  {row.saving > 0 && <span className="block text-[10px] text-gray-400 line-through tabular-nums">{fmt(row.basePrice)}</span>}
                </>
              ) : <span className="text-xs text-gray-300">السعر</span>}
            </div>
            {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="shrink-0 text-red-500"><X className="w-4 h-4" /></button>}
          </div>
        ))}
        <button type="button" onClick={addRow} className="text-sm text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة صنف</button>
      </div>

      {/* البونص والمكافآت والخصم — بتتحسب مباشرة */}
      {(bonusPreview.length > 0 || totalSaving > 0 || pointsEarned > 0) && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5"><Gift className="w-4 h-4" /> مكافآت العميل (بتتضاف تلقائيًا)</p>
          {totalSaving > 0 && (
            <p className="text-xs text-green-700 flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> خصم الفئة: وفّر العميل {fmt(totalSaving)} ج.م</p>
          )}
          {pointsEarned > 0 && (
            <p className="text-xs text-purple-700 flex items-center gap-1"><Star className="w-3.5 h-3.5" /> بونص نقاط: +{fmt(pointsEarned)} نقطة</p>
          )}
          {bonusPreview.map((b) => (
            <p key={b.productId} className="text-xs text-amber-800">🎁 {b.quantity} {unitOf.get(b.productId) || ''} {productName.get(b.productId) || 'صنف'} هدية</p>
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
