'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2, X, Gift, AlertTriangle } from 'lucide-react'

interface CustomerLite { id: string; name: string }
interface RuleLite { qualifyingProductId: string; buyQuantity: number; freeQuantity: number; repeat: boolean }
interface InvItem {
  invoiceItemId: string
  productId: string
  name: string
  unit: string
  isBonus: boolean
  unitPrice: number
  sold: number
  returned: number
  rewardRuleId: string | null
  rule: RuleLite | null
}
interface CustInvoice { id: string; invoiceNo: string; net: number; createdAt: string; hasBonus: boolean; items: InvItem[] }

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const dateOf = (s: string) => new Date(s).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })

export function DeliveryReturnForm({
  deliveryOrderId,
  customers,
}: {
  deliveryOrderId: string
  customers: CustomerLite[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [invoices, setInvoices] = useState<CustInvoice[]>([])
  const [loadingInv, setLoadingInv] = useState(false)
  const [invoiceId, setInvoiceId] = useState('')
  const [qty, setQty] = useState<Record<string, string>>({}) // invoiceItemId -> كمية الإرجاع
  const [refundCash, setRefundCash] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const invoice = invoices.find((v) => v.id === invoiceId) || null
  const lines = invoice ? invoice.items.map((it) => ({ ...it, available: it.sold - it.returned })).filter((it) => it.available > 0) : []

  const total = lines.reduce((s, it) => s + (Number(qty[it.invoiceItemId]) || 0) * it.unitPrice, 0)
  const returnedCount = lines.reduce((s, it) => s + (Number(qty[it.invoiceItemId]) || 0), 0)

  // فحص العرض لحظيًا (نفس منطق السيرفر)
  const offerWarnings = useMemo(() => {
    if (!invoice) return [] as { name: string; shortfall: number }[]
    const keptOf = (it: InvItem) => it.sold - it.returned - (Number(qty[it.invoiceItemId]) || 0)
    const out: { name: string; shortfall: number }[] = []
    const ruleIds = Array.from(new Set(invoice.items.filter((it) => it.isBonus && it.rewardRuleId).map((it) => it.rewardRuleId as string)))
    for (const rid of ruleIds) {
      const giftLines = invoice.items.filter((it) => it.isBonus && it.rewardRuleId === rid)
      const rule = giftLines[0].rule
      if (!rule) continue
      const paidLines = invoice.items.filter((it) => !it.isBonus && it.productId === rule.qualifyingProductId)
      const keptPaid = paidLines.reduce((s, l) => s + keptOf(l), 0)
      const entitle = rule.repeat ? Math.floor(keptPaid / rule.buyQuantity) * rule.freeQuantity : keptPaid >= rule.buyQuantity ? rule.freeQuantity : 0
      const giftKept = giftLines.reduce((s, l) => s + keptOf(l), 0)
      if (giftKept > entitle) out.push({ name: giftLines[0].name, shortfall: giftKept - entitle })
    }
    return out
  }, [invoice, qty])

  const loadInvoices = async (cid: string) => {
    setCustomerId(cid); setInvoiceId(''); setQty({}); setInvoices([]); setError('')
    if (!cid) return
    setLoadingInv(true)
    const res = await fetch(`/api/customers/${cid}/invoices`)
    const data = await res.json()
    setLoadingInv(false)
    if (!res.ok) return setError(data.error || 'فشل تحميل الفواتير')
    setInvoices(data)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!invoice) return setError('اختار الفاتورة اللي بترجّع منها')
    const items = lines.map((it) => ({ invoiceItemId: it.invoiceItemId, quantity: Number(qty[it.invoiceItemId]) || 0 })).filter((it) => it.quantity > 0)
    if (items.length === 0) return setError('حدّد كمية الإرجاع لصنف واحد على الأقل')
    if (offerWarnings.length > 0) return setError('العرض مبقاش محقق — لازم ترجّع وحدات الهدية المطلوبة كمان')

    setLoading(true)
    const res = await fetch(`/api/delivery-orders/${deliveryOrderId}/return`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: invoice.id, refundCash, reason, items }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error || 'حصل خطأ')
    setCustomerId(''); setInvoices([]); setInvoiceId(''); setQty({}); setReason(''); setRefundCash(false); setOpen(false)
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
        <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2"><Undo2 className="w-5 h-5 text-orange-500" /> مرتجع من فاتورة سابقة</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      {/* 1) العميل */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">١. العميل</label>
        <select value={customerId} onChange={(e) => loadInvoices(e.target.value)} className={inputCls}>
          <option value="">اختار العميل</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* 2) الفاتورة */}
      {customerId && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">٢. الفاتورة</label>
          {loadingInv ? (
            <p className="text-sm text-gray-400 py-2">جاري تحميل فواتير العميل...</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">العميل ده مالوش فواتير.</p>
          ) : (
            <select value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); setQty({}); setError('') }} className={inputCls}>
              <option value="">اختار الفاتورة</option>
              {invoices.map((v) => <option key={v.id} value={v.id}>{v.invoiceNo} — {dateOf(v.createdAt)} — {fmt(v.net)} ج.م{v.hasBonus ? ' 🎁' : ''}</option>)}
            </select>
          )}
        </div>
      )}

      {/* 3) البنود */}
      {invoice && (
        <>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500">كل أصناف الفاتورة دي اترجّعت بالكامل.</p>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">٣. حدّد الكمية المرتجعة لكل بند</label>
              {lines.map((it) => (
                <div key={it.invoiceItemId} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1">{it.isBonus && '🎁'} {it.name}{it.isBonus && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">هدية</span>}</p>
                    <p className="text-[11px] text-gray-400 tabular-nums">
                      {it.isBonus ? 'مجانًا' : `${fmt(it.unitPrice)} ج.م`} · متاح للإرجاع {it.available} {it.unit}{it.returned > 0 ? ` (رجع ${it.returned})` : ''}
                    </p>
                  </div>
                  <input type="text" inputMode="decimal" dir="ltr" min="0" max={it.available} placeholder="0" value={qty[it.invoiceItemId] || ''} onChange={(e) => setQty({ ...qty, [it.invoiceItemId]: e.target.value })} className="w-16 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums text-center" />
                </div>
              ))}
            </div>
          )}

          {/* تحذير كسر العرض */}
          {offerWarnings.map((w, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> العرض مبقاش محقق بعد الإرجاع — لازم ترجّع كمان <b className="mx-1">{w.shortfall}</b> من الهدية ({w.name}) من القايمة فوق قبل ما تسجّل.
            </div>
          ))}

          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب المرتجع (اختياري)" className={inputCls} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={refundCash} onChange={(e) => setRefundCash(e.target.checked)} className="w-4 h-4" />
            رد نقدي للعميل (بدل الخصم من رصيده الآجل)
          </label>

          {returnedCount > 0 && (
            <div className="flex justify-between text-sm bg-orange-50 rounded-lg p-2.5">
              <span className="text-gray-600">قيمة المرتجع ({returnedCount} وحدة)</span>
              <span className="font-bold text-orange-700 tabular-nums">{fmt(total)} ج.م</span>
            </div>
          )}

          <button type="submit" disabled={loading || returnedCount === 0 || offerWarnings.length > 0} className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50">
            {loading ? 'جاري التسجيل...' : 'تسجيل المرتجع'}
          </button>
        </>
      )}
    </form>
  )
}
