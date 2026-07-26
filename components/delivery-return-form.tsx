'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2, X, Gift } from 'lucide-react'

interface InvItem {
  productId: string
  name: string
  unit: string
  isBonus: boolean
  unitPrice: number
  sold: number
  returned: number
}
interface RoundInvoice {
  id: string
  invoiceNo: string
  customerId: string
  customerName: string
  net: number
  hasBonus: boolean
  items: InvItem[]
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

export function DeliveryReturnForm({
  deliveryOrderId,
  invoices,
}: {
  deliveryOrderId: string
  invoices: RoundInvoice[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [invoiceId, setInvoiceId] = useState('')
  const [qty, setQty] = useState<Record<string, string>>({}) // productId -> كمية الإرجاع
  const [refundCash, setRefundCash] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const invoice = invoices.find((v) => v.id === invoiceId) || null
  // البنود المتاحة للإرجاع (المباع − اللي رجع قبل كده)
  const lines = invoice ? invoice.items.map((it) => ({ ...it, available: it.sold - it.returned })).filter((it) => it.available > 0) : []
  // الهدايا اللي راحت مع الفاتورة (للتنبيه إن المندوب يسحبها)
  const giftLines = invoice ? invoice.items.filter((it) => it.isBonus) : []

  const total = lines.reduce((s, it) => s + (Number(qty[it.productId]) || 0) * it.unitPrice, 0)
  const returnedCount = lines.reduce((s, it) => s + (Number(qty[it.productId]) || 0), 0)

  const selectInvoice = (id: string) => { setInvoiceId(id); setQty({}); setError('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!invoice) return setError('اختار الفاتورة اللي هترجّع منها')
    const items = lines
      .map((it) => ({ productId: it.productId, quantity: Number(qty[it.productId]) || 0, available: it.available }))
      .filter((it) => it.quantity > 0)
    if (items.length === 0) return setError('حدّد كمية الإرجاع لصنف واحد على الأقل')
    if (items.some((it) => it.quantity > it.available)) return setError('كمية الإرجاع أكبر من المباع في الفاتورة')

    setLoading(true)
    const res = await fetch(`/api/delivery-orders/${deliveryOrderId}/return`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: invoice.id, refundCash, reason, items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error || 'حصل خطأ')
    setInvoiceId(''); setQty({}); setReason(''); setRefundCash(false); setOpen(false)
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

      {invoices.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">مفيش فواتير في الجولة دي عشان ترجّع منها.</p>
      ) : (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الفاتورة</label>
            <select value={invoiceId} onChange={(e) => selectInvoice(e.target.value)} className={inputCls}>
              <option value="">اختار فاتورة العميل</option>
              {invoices.map((v) => <option key={v.id} value={v.id}>{v.invoiceNo} — {v.customerName} — {fmt(v.net)} ج.م{v.hasBonus ? ' 🎁' : ''}</option>)}
            </select>
          </div>

          {invoice && (
            <>
              {giftLines.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5"><Gift className="w-4 h-4" /> الهدية اللي راحت مع الفاتورة دي:</p>
                  {giftLines.map((g) => (
                    <p key={g.productId} className="tabular-nums">🎁 {g.sold} {g.unit} {g.name}</p>
                  ))}
                  <p className="text-[11px] text-amber-700">لو العميل بيرجّع الأصناف اللي أخدت الهدية — اسحب الهدية منه كمان وحطّها في القايمة تحت. بونص النقاط بيتعدّل تلقائيًا.</p>
                </div>
              )}

              {lines.length === 0 ? (
                <p className="text-sm text-gray-500">كل أصناف الفاتورة دي اترجّعت بالكامل.</p>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">حدّد الكمية المرتجعة لكل صنف</label>
                  {lines.map((it) => (
                    <div key={it.productId} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate flex items-center gap-1">{it.isBonus && '🎁'} {it.name}</p>
                        <p className="text-[11px] text-gray-400 tabular-nums">
                          {it.isBonus ? 'هدية' : `${fmt(it.unitPrice)} ج.م`} · متاح للإرجاع {it.available} {it.unit}{it.returned > 0 ? ` (رجع ${it.returned})` : ''}
                        </p>
                      </div>
                      <input
                        type="number" min="0" max={it.available} placeholder="0"
                        value={qty[it.productId] || ''}
                        onChange={(e) => setQty({ ...qty, [it.productId]: e.target.value })}
                        className="w-16 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums text-center"
                      />
                    </div>
                  ))}
                </div>
              )}

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

              <button type="submit" disabled={loading || returnedCount === 0} className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50">
                {loading ? 'جاري التسجيل...' : 'تسجيل المرتجع'}
              </button>
            </>
          )}
        </>
      )}
    </form>
  )
}
