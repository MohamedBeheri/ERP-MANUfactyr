'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Clock, CheckCircle2, XCircle } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const STATUS: Record<string, { label: string; cls: string; Icon: any }> = {
  PENDING: { label: 'بانتظار اعتماد الخزنة', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  ACCEPTED: { label: 'تمت التسوية', cls: 'bg-green-50 text-green-700', Icon: CheckCircle2 },
  REJECTED: { label: 'مرفوضة', cls: 'bg-red-50 text-red-600', Icon: XCircle },
}
interface Settlement { id: string; settlementNo: string; amount: number; status: string; createdAt: string; acceptedByName: string | null }

export function DelegateTreasurySettle({ balance, pendingTotal, settlements }: { balance: number; pendingTotal: number; settlements: Settlement[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const available = balance // الرصيد المتاح للتسوية

  const settle = async () => {
    if (!confirm(`تسوية خزنتك مع الخزنة العمومية بمبلغ ${money(available)} ج.م؟ أمين الخزنة هيعتمدها.`)) return
    setBusy(true); setError('')
    const res = await fetch('/api/drivers/settle-treasury', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const data = await res.json(); setBusy(false)
    if (!res.ok) return setError(data.error || 'فشل التسوية')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-[#1a1a2e]">خزنتي — التسوية مع العمومية</h3>
          <p className="text-xs text-gray-500 mt-0.5">رصيد خزنتك (بيع كاش + تحصيل) — بتسلّمه للخزنة العمومية آخر اليوم</p>
          {pendingTotal > 0 && <p className="text-[11px] text-amber-600 mt-0.5">فيه {money(pendingTotal)} ج.م تسويات مقدّمة لسه بانتظار الاعتماد</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left"><p className="text-[11px] text-gray-400">رصيد خزنتك</p><p className="text-xl font-bold text-[#0f3460] tabular-nums">{money(balance)} <span className="text-xs font-normal">ج.م</span></p></div>
          <button onClick={settle} disabled={busy || available <= 0} className="bg-[#0f3460] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-40 flex items-center gap-1.5"><ArrowLeftRight className="w-4 h-4" /> {busy ? 'جاري...' : 'تسوية خزنتي'}</button>
        </div>
      </div>
      {error && <div className="m-4 bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
      {settlements.length > 0 && (
        <div className="divide-y divide-gray-50">
          {settlements.map((s) => {
            const st = STATUS[s.status] || STATUS.PENDING; const Icon = st.Icon
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 sm:px-5">
                <div className="flex-1 min-w-0"><p className="font-bold text-xs text-[#0f3460] tabular-nums">{s.settlementNo}</p><p className="text-[11px] text-gray-400 tabular-nums">{new Date(s.createdAt).toLocaleString('ar-EG')}{s.acceptedByName ? ` · اعتمدها ${s.acceptedByName}` : ''}</p></div>
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
