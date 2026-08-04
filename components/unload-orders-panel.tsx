'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, CheckCircle2, X, PackageCheck } from 'lucide-react'

interface UnloadLite {
  id: string
  unloadNo: string
  delegateName: string
  vehicle: string | null
  orderNo: string | null
  warehouseName: string | null
  createdAt: string
  items: { name: string; unit: string; quantity: number; kind: string }[]
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 })

// أوامر تفريغ العربيات المعلقة — المخزن بيأكد الاستلام وساعتها بس البضاعة بتدخل
export function UnloadOrdersPanel({ unloads, canEdit }: { unloads: UnloadLite[]; canEdit: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function act(id: string, action: 'confirm' | 'cancel') {
    if (action === 'cancel' && !confirm('إلغاء أمر التفريغ ده؟ البضاعة مش هتدخل المخزن.')) return
    setBusy(id)
    setError('')
    const res = await fetch(`/api/unload-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusy('')
    if (!res.ok) return setError((await res.json()).error || 'حصل خطأ')
    router.refresh()
  }

  if (unloads.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-amber-200">
      <div className="flex items-center gap-2 p-5 pb-3 bg-amber-50/50">
        <Truck className="w-5 h-5 text-amber-700" />
        <h3 className="text-base font-bold text-[#1a1a2e]">أوامر تفريغ في انتظار استلام المخزن ({unloads.length})</h3>
      </div>
      {error && <p className="px-5 py-2 text-sm text-red-600 bg-red-50">{error}</p>}
      <div className="divide-y divide-gray-50">
        {unloads.map((u) => (
          <div key={u.id} className="p-4 px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-[#1a1a2e] tabular-nums">
                  {u.unloadNo}
                  <span className="font-normal text-gray-500"> — مندوب: {u.delegateName}{u.vehicle ? ` · عربية ${u.vehicle}` : ''}{u.orderNo ? ` · جولة ${u.orderNo}` : ''}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {u.items.map((it, i) => (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded font-semibold tabular-nums ${it.kind === 'RETURN' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                      {it.name} {fmt(it.quantity)} {it.unit} — {it.kind === 'RETURN' ? 'مرتجع عميل' : 'بواقي بيع'}
                    </span>
                  ))}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => act(u.id, 'confirm')}
                    disabled={busy === u.id}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <PackageCheck className="w-4 h-4" /> {busy === u.id ? 'جارٍ...' : 'تأكيد الاستلام'}
                  </button>
                  <button
                    onClick={() => act(u.id, 'cancel')}
                    disabled={busy === u.id}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="إلغاء الأمر"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
