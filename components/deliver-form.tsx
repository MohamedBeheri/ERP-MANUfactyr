'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Plus, X, UserPlus, Percent, Star, ArrowRight, Check, Printer, MessageCircle, Banknote, Wallet, Smartphone, CheckCircle2 } from 'lucide-react'
import { EGYPT_GOVERNORATES } from '@/lib/governorates'
import { LocationPicker, type GeoPoint } from '@/components/location-picker'

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

const PAY_METHODS = [
  { key: 'نقدي فوري', label: 'فوري', desc: 'المبلغ كامل دلوقتي' },
  { key: 'آجل', label: 'آجل', desc: 'على حساب العميل' },
  { key: 'نقدي جزئي', label: 'جزئي', desc: 'جزء دلوقتي والباقي آجل' },
] as const
const COLLECTION_METHODS = [
  { key: 'نقدي', label: 'نقدي', Icon: Banknote },
  { key: 'تحويل محفظة', label: 'تحويل محفظة', Icon: Wallet },
  { key: 'تحويل انستا', label: 'تحويل انستا', Icon: Smartphone },
] as const

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

// نفس منطق السيرفر — سعر الصنف حسب فئة/نوع العميل
function priceFor(cust: { customerType?: string | null; tier: TierLite | null } | null, item: RemainingItem): number {
  const source = cust?.tier?.priceSource ?? (cust?.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL')
  const base = source === 'WHOLESALE' && item.wholesalePrice > 0 ? item.wholesalePrice : item.sellPrice
  const disc = cust?.tier ? cust.tier.discountPercent : 0
  return Math.max(0, +(base * (1 - disc / 100)).toFixed(2))
}
// تحويل رقم موبايل مصري لصيغة واتساب دولية
function waPhone(p?: string | null): string {
  let d = (p || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '2' + d
  else if (d.length === 10) d = '20' + d
  return d
}

type Step = 'items' | 'payment' | 'collection' | 'done'
interface Receipt {
  id: string; invoiceNo: string; customerName: string; customerPhone: string | null
  net: number; paid: number; remaining: number; paymentMethod: string; collectionMethod: string | null
  lines: { name: string; qty: number; unitPrice: number; lineTotal: number; unit: string }[]
  bonuses: { name: string; qty: number; unit: string }[]
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
  const [step, setStep] = useState<Step>('items')
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [customerId, setCustomerId] = useState('')
  const [nc, setNc] = useState({ name: '', phone: '', address: '', activityType: '', customerType: 'RETAIL' as 'RETAIL' | 'WHOLESALE', governorate: '' })
  const [geo, setGeo] = useState<GeoPoint | null>(null)
  const [payMethod, setPayMethod] = useState<string>('')
  const [paidAmount, setPaidAmount] = useState('')
  const [collectionMethod, setCollectionMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([{ productId: '', quantity: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  const selectedCustomer = customers.find((c) => c.id === customerId) || null
  const activeCustomer = mode === 'existing' ? selectedCustomer : { customerType: nc.customerType, tier: null }
  const activeTierId = mode === 'existing' ? (selectedCustomer?.tierId ?? null) : null
  const customerLabel = mode === 'existing' ? (selectedCustomer?.name || '') : (nc.name || 'عميل جديد')

  const itemOf = new Map(remainingItems.map((r) => [r.productId, r]))
  const productName = new Map(remainingItems.map((r) => [r.productId, r.productName]))
  const unitOf = new Map(remainingItems.map((r) => [r.productId, r.unit]))
  const availableItems = remainingItems.filter((item) => item.remaining > 0)

  const addRow = () => setRows([...rows, { productId: '', quantity: '' }])
  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i))
  const updateRow = (i: number, field: 'productId' | 'quantity', value: string) =>
    setRows(rows.map((row, j) => (j === i ? { ...row, [field]: value } : row)))

  const pricedRows = rows.map((r) => {
    const item = r.productId ? itemOf.get(r.productId) || null : null
    const unitPrice = item ? (activeCustomer ? priceFor(activeCustomer, item) : item.sellPrice) : 0
    const basePrice = item ? item.sellPrice : 0
    const qty = Number(r.quantity) || 0
    return { ...r, unitPrice, basePrice, qty, lineTotal: qty * unitPrice, saving: Math.max(0, (basePrice - unitPrice) * qty) }
  })
  const validLines = pricedRows.filter((r) => r.productId && r.qty > 0)
  const netAmount = pricedRows.reduce((s, r) => s + r.lineTotal, 0)
  const totalSaving = pricedRows.reduce((s, r) => s + r.saving, 0)
  const bonusPct = activeCustomer?.tier?.bonusPercent || 0
  const pointsEarned = bonusPct > 0 ? +((netAmount * bonusPct) / 100).toFixed(2) : 0

  const bonusPreview = useMemo(() => {
    const qtyByProduct = new Map<string, number>()
    rows.forEach((r) => { if (r.productId && Number(r.quantity) > 0) qtyByProduct.set(r.productId, (qtyByProduct.get(r.productId) || 0) + Number(r.quantity)) })
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

  const paidNow = payMethod === 'آجل' ? 0 : payMethod === 'نقدي جزئي' ? Math.min(netAmount, Number(paidAmount) || 0) : netAmount
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

  // التليفون اختياري — لكن لو اتكتب لازم 11 رقم (بنقبل الأرقام العربية)
  const phoneDigits = (p: string) => p.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')
  const ncPhoneInvalid = nc.phone.trim() !== '' && phoneDigits(nc.phone).length !== 11

  // ===== الانتقال بين الخطوات =====
  const toPayment = () => {
    setError('')
    if (mode === 'existing' && !customerId) return setError('اختار العميل الأول')
    if (mode === 'new' && !nc.name.trim()) return setError('اكتب اسم العميل الجديد')
    if (mode === 'new' && ncPhoneInvalid) return setError('رقم التليفون لازم يكون 11 رقم')
    if (validLines.length === 0) return setError('اختار صنف واحد على الأقل')
    setStep('payment')
  }
  const fromPayment = () => {
    setError('')
    if (!payMethod) return setError('اختار طريقة الدفع')
    if (payMethod === 'نقدي جزئي' && !(Number(paidAmount) > 0)) return setError('اكتب المبلغ المدفوع دلوقتي')
    if (payMethod === 'آجل') submit('آجل', null)
    else setStep('collection')
  }
  const confirmCollection = () => {
    setError('')
    if (!collectionMethod) return setError('اختار طريقة استلام المبلغ')
    submit(payMethod, collectionMethod)
  }

  const submit = async (pm: string, cm: string | null) => {
    setError(''); setLoading(true)
    let finalCustomerId = customerId
    if (mode === 'new') {
      const cRes = await fetch('/api/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nc.name.trim(), phone: nc.phone.trim() || undefined, address: nc.address.trim() || undefined, activityType: nc.activityType.trim() || undefined, customerType: nc.customerType, area: delegateArea || undefined, governorate: nc.governorate || undefined, lat: geo?.lat, lng: geo?.lng }),
      })
      const cData = await cRes.json()
      if (!cRes.ok) { setLoading(false); return setError(cData.error || 'خطأ في إضافة العميل') }
      finalCustomerId = cData.id
    }
    const res = await fetch(`/api/delivery-orders/${deliveryOrderId}/deliver`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: finalCustomerId, items: validLines.map((r) => ({ productId: r.productId, quantity: r.qty })), paymentMethod: pm, collectionMethod: cm || undefined, paidAmount: pm === 'نقدي جزئي' ? Number(paidAmount) : undefined, notes: notes || undefined }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error || 'حصل خطأ')
    setReceipt({
      id: data.id, invoiceNo: data.invoiceNo, customerName: data.customer?.name || customerLabel, customerPhone: data.customer?.phone || (mode === 'new' ? nc.phone : null),
      net: Number(data.netAmount), paid: Number(data.paidAmount), remaining: Number(data.netAmount) - Number(data.paidAmount), paymentMethod: pm, collectionMethod: cm,
      lines: validLines.map((r) => ({ name: productName.get(r.productId) || 'صنف', qty: r.qty, unitPrice: r.unitPrice, lineTotal: r.lineTotal, unit: unitOf.get(r.productId) || '' })),
      bonuses: bonusPreview.map((b) => ({ name: productName.get(b.productId) || 'صنف', qty: b.quantity, unit: unitOf.get(b.productId) || '' })),
    })
    setStep('done')
  }

  const resetAll = () => {
    setStep('items'); setMode('existing'); setCustomerId(''); setNc({ name: '', phone: '', address: '', activityType: '', customerType: 'RETAIL', governorate: '' })
    setGeo(null)
    setPayMethod(''); setPaidAmount(''); setCollectionMethod(''); setNotes(''); setRows([{ productId: '', quantity: '' }]); setReceipt(null); setError('')
    router.refresh()
  }

  // ===== شاشة النجاح (طباعة + واتساب) =====
  if (step === 'done' && receipt) {
    const waMsg =
      `🧾 *شركة البدر لتجارة البن*\nفاتورة رقم: ${receipt.invoiceNo}\nالعميل: ${receipt.customerName}\n\n*الأصناف:*\n` +
      receipt.lines.map((l) => `• ${l.name} — ${l.qty} ${l.unit} × ${fmt(l.unitPrice)} = ${fmt(l.lineTotal)} ج.م`).join('\n') +
      (receipt.bonuses.length ? `\n\n*🎁 هدايا مجانية:*\n` + receipt.bonuses.map((b) => `• ${b.name} — ${b.qty} ${b.unit}`).join('\n') : '') +
      `\n\n*الإجمالي:* ${fmt(receipt.net)} ج.م\n*المدفوع:* ${fmt(receipt.paid)} ج.م${receipt.collectionMethod ? ` (${receipt.collectionMethod})` : ''}\n*المتبقي:* ${fmt(receipt.remaining)} ج.م\n\nشكرًا لتعاملكم معنا 🌟`
    const waHref = `https://wa.me/${receipt.customerPhone ? waPhone(receipt.customerPhone) : ''}?text=${encodeURIComponent(waMsg)}`
    return (
      <div className="bg-white p-5 rounded-xl shadow-sm space-y-4">
        <div className="text-center py-2">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-[#1a1a2e]">تم تسليم العميل ✓</h3>
          <p className="text-sm text-gray-500 mt-0.5">{receipt.customerName} · فاتورة {receipt.invoiceNo}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-gray-500">الإجمالي</span><span className="font-bold tabular-nums">{fmt(receipt.net)} ج.م</span></div>
          <div className="flex justify-between"><span className="text-gray-500">المدفوع {receipt.collectionMethod ? `(${receipt.collectionMethod})` : ''}</span><span className="font-bold tabular-nums text-green-700">{fmt(receipt.paid)} ج.م</span></div>
          {receipt.remaining > 0 && <div className="flex justify-between"><span className="text-gray-500">المتبقي (آجل)</span><span className="font-bold tabular-nums text-amber-700">{fmt(receipt.remaining)} ج.م</span></div>}
          {receipt.bonuses.length > 0 && <div className="flex justify-between"><span className="text-gray-500">🎁 هدايا</span><span className="font-bold tabular-nums text-rose-700">{receipt.bonuses.reduce((s, b) => s + b.qty, 0)} وحدة</span></div>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={`/print/invoice/${receipt.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#0f3460] text-white py-3 rounded-lg font-bold hover:bg-[#0a2545]"><Printer className="w-4 h-4" /> طباعة الفاتورة</a>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-lg font-bold hover:bg-[#1da851]"><MessageCircle className="w-4 h-4" /> إرسال واتساب</a>
        </div>
        <button onClick={resetAll} className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-50">تسليم عميل جديد</button>
      </div>
    )
  }

  // ===== مؤشر الخطوات =====
  const steps: { key: Step; label: string }[] = [{ key: 'items', label: 'الأصناف' }, { key: 'payment', label: 'الدفع' }, { key: 'collection', label: 'الاستلام' }]
  const stepIdx = steps.findIndex((s) => s.key === step)

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1a1a2e]">تنزيل بضاعة لعميل</h3>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <span key={s.key} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${i === stepIdx ? 'bg-[#0f3460] text-white' : i < stepIdx ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{i + 1}. {s.label}</span>
          ))}
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      {/* ========== الخطوة 1: العميل + الأصناف ========== */}
      {step === 'items' && (
        <>
          <div>
            <div className="flex gap-1.5 mb-2">
              <button type="button" onClick={() => setMode('existing')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition ${mode === 'existing' ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600'}`}>عميل موجود</button>
              <button type="button" onClick={() => setMode('new')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${mode === 'new' ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600'}`}><UserPlus className="w-3.5 h-3.5" /> عميل جديد</button>
            </div>
            {mode === 'existing' ? (
              <>
                <label className="block text-sm font-semibold text-gray-700 mb-1">العميل {delegateArea ? <span className="text-xs font-normal text-gray-400">(نطاق: {delegateArea})</span> : null}</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
                  <option value="">اختار عميل من نطاقك</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.tierName ? ` — ${c.tierName}` : c.customerType === 'WHOLESALE' ? ' — جملة' : ''}</option>)}
                </select>
                {selectedCustomer && <p className="text-xs text-gray-500 mt-1">{(selectedCustomer.tier?.priceSource === 'WHOLESALE' || selectedCustomer.customerType === 'WHOLESALE') ? 'سعر جملة' : 'سعر قطاعي'}{selectedCustomer.tier && selectedCustomer.tier.discountPercent > 0 ? ` · خصم فئة ${selectedCustomer.tier.discountPercent}%` : ''}</p>}
              </>
            ) : (
              <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                <input placeholder="اسم العميل *" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="رقم التليفون (11 رقم)" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} className={`${inputCls} ${ncPhoneInvalid ? 'border-red-300' : ''}`} inputMode="tel" maxLength={11} dir="ltr" />
                  <input placeholder="نوع النشاط (كافيه/سوبر ماركت)" value={nc.activityType} onChange={(e) => setNc({ ...nc, activityType: e.target.value })} className={inputCls} />
                </div>
                <input placeholder="العنوان" value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} className={inputCls} />
                <select value={nc.governorate} onChange={(e) => setNc({ ...nc, governorate: e.target.value })} className={inputCls}>
                  <option value="">اختار المحافظة (اختياري)</option>
                  {EGYPT_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <LocationPicker value={geo} onChange={setGeo} label="تسجيل موقعي الحالي مع العميل" allowManual={false} />
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">نوع العميل (بيحدد السعر)</label>
                  <div className="flex gap-1.5">
                    {(['RETAIL', 'WHOLESALE'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setNc({ ...nc, customerType: t })} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition ${nc.customerType === t ? 'bg-[#0f3460] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{t === 'RETAIL' ? 'قطاعي' : 'جملة'}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">الأصناف <span className="text-xs font-normal text-gray-400">(السعر تلقائي حسب العميل)</span></label>
            {pricedRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={row.productId} onChange={(e) => updateRow(i, 'productId', e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">اختار الصنف</option>
                  {availableItems.map((p) => <option key={p.productId} value={p.productId}>{p.productName} (متبقي {p.remaining} {p.unit})</option>)}
                </select>
                <input type="text" inputMode="decimal" dir="ltr" min="1" placeholder="كمية" value={row.quantity} onChange={(e) => updateRow(i, 'quantity', e.target.value)} className="w-16 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
                <div className="w-24 shrink-0 text-center bg-gray-50 rounded-lg py-2 px-1">
                  {row.productId ? (<><span className="block text-sm font-bold tabular-nums text-[#0f3460]">{fmt(row.unitPrice)}</span>{row.saving > 0 && <span className="block text-[10px] text-gray-400 line-through tabular-nums">{fmt(row.basePrice)}</span>}</>) : <span className="text-xs text-gray-300">السعر</span>}
                </div>
                {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="shrink-0 text-red-500"><X className="w-4 h-4" /></button>}
              </div>
            ))}
            <button type="button" onClick={addRow} className="text-sm text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة صنف</button>
          </div>

          {(bonusPreview.length > 0 || totalSaving > 0 || pointsEarned > 0) && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5"><Gift className="w-4 h-4" /> مكافآت العميل (بتتضاف تلقائيًا)</p>
              {totalSaving > 0 && <p className="text-xs text-green-700 flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> خصم الفئة: وفّر العميل {fmt(totalSaving)} ج.م</p>}
              {pointsEarned > 0 && <p className="text-xs text-purple-700 flex items-center gap-1"><Star className="w-3.5 h-3.5" /> بونص نقاط: +{fmt(pointsEarned)} نقطة</p>}
              {bonusPreview.map((b) => <p key={b.productId} className="text-xs text-amber-800">🎁 {b.quantity} {unitOf.get(b.productId) || ''} {productName.get(b.productId) || 'صنف'} هدية</p>)}
            </div>
          )}

          {netAmount > 0 && <div className="flex justify-between text-sm bg-gray-50 rounded-lg p-2.5"><span className="text-gray-500">إجمالي الفاتورة</span><span className="font-bold tabular-nums">{fmt(netAmount)} ج.م</span></div>}

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات على الفاتورة (اختياري)" rows={2} className={inputCls} />
          <button type="button" onClick={toPayment} className="w-full bg-[#0f3460] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2545] flex items-center justify-center gap-2"><Check className="w-4 h-4" /> تأكيد التنزيل والانتقال للدفع</button>
        </>
      )}

      {/* ========== الخطوة 2: طريقة الدفع ========== */}
      {step === 'payment' && (
        <>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">العميل</span><span className="font-semibold">{customerLabel}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">عدد الأصناف</span><span className="font-semibold tabular-nums">{validLines.length} ({validLines.reduce((s, r) => s + r.qty, 0)} وحدة)</span></div>
            {bonusPreview.length > 0 && <div className="flex justify-between"><span className="text-gray-500">🎁 هدايا</span><span className="font-semibold tabular-nums text-rose-700">{bonusPreview.reduce((s, b) => s + b.quantity, 0)} وحدة</span></div>}
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="text-gray-500">الإجمالي</span><span className="font-bold tabular-nums text-[#0f3460]">{fmt(netAmount)} ج.م</span></div>
          </div>

          <label className="block text-sm font-semibold text-gray-700">طريقة الدفع</label>
          <div className="grid grid-cols-3 gap-2">
            {PAY_METHODS.map((m) => (
              <button key={m.key} type="button" onClick={() => setPayMethod(m.key)} className={`p-3 rounded-xl text-center transition border-2 ${payMethod === m.key ? 'border-[#0f3460] bg-[#0f3460]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                <span className={`block font-bold text-sm ${payMethod === m.key ? 'text-[#0f3460]' : 'text-gray-700'}`}>{m.label}</span>
                <span className="block text-[10px] text-gray-400 mt-0.5">{m.desc}</span>
              </button>
            ))}
          </div>

          {payMethod === 'نقدي جزئي' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">المبلغ المدفوع دلوقتي (المتبقي {fmt(Math.max(0, netAmount - (Number(paidAmount) || 0)))} ج.م آجل)</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" max={netAmount} step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="المبلغ المدفوع" className={inputCls} />
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('items')} className="px-4 py-3 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 flex items-center gap-1"><ArrowRight className="w-4 h-4" /> رجوع</button>
            <button type="button" onClick={fromPayment} disabled={loading} className="flex-1 bg-[#0f3460] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50">
              {payMethod === 'آجل' ? (loading ? 'جاري التسليم...' : 'تأكيد التسليم (آجل)') : 'التالي: طريقة الاستلام'}
            </button>
          </div>
        </>
      )}

      {/* ========== الخطوة 3: طريقة استلام المبلغ ========== */}
      {step === 'collection' && (
        <>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">العميل</span><span className="font-semibold">{customerLabel}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">طريقة الدفع</span><span className="font-semibold">{PAY_METHODS.find((p) => p.key === payMethod)?.label}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="text-gray-500">المطلوب استلامه دلوقتي</span><span className="font-bold tabular-nums text-green-700">{fmt(paidNow)} ج.م</span></div>
          </div>

          <label className="block text-sm font-semibold text-gray-700">إزاي استلمت المبلغ؟</label>
          <div className="grid grid-cols-3 gap-2">
            {COLLECTION_METHODS.map((m) => (
              <button key={m.key} type="button" onClick={() => setCollectionMethod(m.key)} className={`p-3 rounded-xl text-center transition border-2 flex flex-col items-center gap-1.5 ${collectionMethod === m.key ? 'border-[#0f3460] bg-[#0f3460]/5 text-[#0f3460]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <m.Icon className="w-6 h-6" />
                <span className="font-bold text-xs">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('payment')} className="px-4 py-3 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 flex items-center gap-1"><ArrowRight className="w-4 h-4" /> رجوع</button>
            <button type="button" onClick={confirmCollection} disabled={loading} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> {loading ? 'جاري التسليم...' : 'تأكيد التسليم'}</button>
          </div>
        </>
      )}
    </div>
  )
}
