'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HandCoins, CheckCircle2 } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })

interface CustomerRow { id: string; name: string; phone: string | null; balance: number }
interface Method { id: string; name: string; type: string }

export function DelegateCollect({ customers, methods }: { customers: CustomerRow[]; methods: Method[] }) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState(methods[0]?.id || '')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const selected = customers.find((c) => c.id === customerId)
  const method = methods.find((m) => m.id === methodId)
  const isElectronic = method?.type === 'ELECTRONIC'

  const submit = async () => {
    if (!customerId) return setError('اختار العميل')
    if (!amount || Number(amount) <= 0) return setError('اكتب المبلغ')
    setBusy(true); setError(''); setOk('')
    const res = await fetch('/api/drivers/collect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, amount, paymentMethodId: methodId, transactionReference: reference, notes }),
    })
    const data = await res.json(); setBusy(false)
    if (!res.ok) return setError(data.error || 'فشل التحصيل')
    setOk(`تم تسجيل التحصيل ${data.collectionNo} — فتحنا لك إيصال التحصيل للطباعة`)
    // فتح فاتورة التحصيل للطباعة فورًا
    if (data.id) window.open(`/print/collection/${data.id}`, '_blank')
    setCustomerId(''); setAmount(''); setReference(''); setNotes('')
    router.refresh()
  }

  const withDebt = customers.filter((c) => c.balance > 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
      {/* نموذج التحصيل */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2"><HandCoins className="w-5 h-5 text-[#e94560]" /><h3 className="font-bold text-[#1a1a2e]">تسجيل تحصيل من عميل</h3></div>
        {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
        {ok && <div className="bg-green-50 text-green-700 p-2.5 rounded-lg text-xs flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {ok}</div>}
        <div>
          <label className="text-[11px] text-gray-500">العميل</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
            <option value="">— اختار عميل —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.balance > 0 ? ` (عليه ${money(c.balance)} ج.م)` : ''}</option>)}
          </select>
        </div>
        {selected && <p className="text-xs text-gray-500">مديونية العميل الحالية: <b className={selected.balance > 0 ? 'text-red-600' : 'text-green-700'}>{money(selected.balance)} ج.م</b></p>}
        <div>
          <label className="text-[11px] text-gray-500">المبلغ المحصّل</label>
          <input type="text" inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm tabular-nums" />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">وسيلة الدفع</label>
          <select value={methodId} onChange={(e) => setMethodId(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {isElectronic && (
          <div>
            <label className="text-[11px] text-gray-500">الرقم المرجعي للعملية *</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
          </div>
        )}
        <div>
          <label className="text-[11px] text-gray-500">ملاحظات</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
        </div>
        <button onClick={submit} disabled={busy} className="w-full bg-[#e94560] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#c73e54] disabled:opacity-50">{busy ? 'جاري...' : 'تسجيل التحصيل'}</button>
      </div>

      {/* عملاء عليهم مديونية */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100"><h3 className="font-bold text-[#1a1a2e]">عملاء عليهم مديونية ({withDebt.length})</h3><p className="text-xs text-gray-500 mt-0.5">إجمالي {money(withDebt.reduce((s, c) => s + c.balance, 0))} ج.م — اضغط عميل عشان تحصّل منه</p></div>
        {withDebt.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">مفيش مديونيات على عملائك 🎉</p> : (
          <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {withDebt.sort((a, b) => b.balance - a.balance).map((c) => (
              <button key={c.id} onClick={() => { setCustomerId(c.id); setAmount(String(c.balance)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`w-full flex items-center justify-between gap-3 p-3 sm:px-5 text-right hover:bg-gray-50 ${customerId === c.id ? 'bg-[#e94560]/5' : ''}`}>
                <div className="min-w-0"><p className="font-semibold text-sm text-[#1a1a2e] truncate">{c.name}</p>{c.phone && <p className="text-[11px] text-gray-400" dir="ltr">{c.phone}</p>}</div>
                <span className="text-sm font-bold tabular-nums text-red-600">{money(c.balance)} ج.م</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
