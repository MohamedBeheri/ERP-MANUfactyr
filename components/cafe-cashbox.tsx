'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, ArrowLeftRight, Clock, CheckCircle2, XCircle } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })

const STATUS: Record<string, { label: string; cls: string; Icon: any }> = {
  PENDING: { label: 'بانتظار موافقة الخزنة', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  ACCEPTED: { label: 'تمت التسوية', cls: 'bg-green-50 text-green-700', Icon: CheckCircle2 },
  REJECTED: { label: 'مرفوضة', cls: 'bg-red-50 text-red-600', Icon: XCircle },
}

interface Settlement { id: string; settlementNo: string; amount: number; status: string; createdByName: string | null; acceptedByName: string | null; createdAt: string }

export function CafeCashbox({ warehouseId, balance, canSettle, settlements }: {
  warehouseId: string
  balance: number
  canSettle: boolean
  settlements: Settlement[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true); setError('')
    const res = await fetch('/api/warehouse/settlements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId, amount, notes }),
    })
    const data = await res.json(); setBusy(false)
    if (!res.ok) return setError(data.error || 'فشل تقديم التسوية')
    setAmount(''); setNotes(''); setOpen(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0f3460]/10 flex items-center justify-center shrink-0"><Wallet className="w-6 h-6 text-[#0f3460]" /></div>
          <div>
            <h3 className="text-base font-bold text-[#1a1a2e]">خزنة الكافيه</h3>
            <p className="text-xs text-gray-500 mt-0.5">الكاش المحصّل من المبيعات — يتسوّى مع الخزنة العمومية زي المندوب</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="text-[11px] text-gray-400">الرصيد الحالي</p>
            <p className="text-xl font-bold text-[#0f3460] tabular-nums">{money(balance)} <span className="text-xs font-normal">ج.م</span></p>
          </div>
          {canSettle && (
            <button onClick={() => setOpen((v) => !v)} className="bg-[#0f3460] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4" /> تسوية مع العمومية
            </button>
          )}
        </div>
      </div>

      {open && canSettle && (
        <div className="p-4 sm:p-5 bg-gray-50/60 border-b border-gray-100 space-y-3">
          {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-500">المبلغ المسلَّم للخزنة العمومية</label>
              <input type="text" inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`أقصى ${money(balance)}`} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">ملاحظات (اختياري)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">أمين الخزنة العمومية بيراجع ويوافق على التسوية من شاشة الخزنة — وقتها بيتخصم من خزنة الكافيه ويتضاف للعمومية.</p>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="bg-[#0f3460] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50">{busy ? 'جاري...' : 'تقديم التسوية'}</button>
            <button onClick={() => setOpen(false)} className="px-4 py-2.5 text-gray-500 text-sm">إلغاء</button>
          </div>
        </div>
      )}

      {settlements.length === 0 ? (
        <p className="p-6 text-center text-gray-400 text-sm">مفيش تسويات لسه</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {settlements.map((s) => {
            const st = STATUS[s.status] || STATUS.PENDING
            const Icon = st.Icon
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 sm:px-5">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-[#0f3460] tabular-nums">{s.settlementNo}</p>
                  <p className="text-[11px] text-gray-400 tabular-nums">{new Date(s.createdAt).toLocaleDateString('ar-EG')} · {s.createdByName || '—'}{s.acceptedByName ? ` · اعتمدها ${s.acceptedByName}` : ''}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${st.cls}`}><Icon className="w-3 h-3" /> {st.label}</span>
                <span className="text-sm font-bold tabular-nums text-[#1a1a2e]">{money(s.amount)} ج.م</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
