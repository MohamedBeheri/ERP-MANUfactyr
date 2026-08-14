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
  items: { id: string; name: string; unit: string; quantity: number; kind: string }[]
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 })

// أوامر تفريغ العربيات المعلقة — المخزن بيأكد الاستلام وساعتها بس البضاعة بتدخل
export function UnloadOrdersPanel({ unloads, canEdit }: { unloads: UnloadLite[]; canEdit: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notesById, setNotesById] = useState<Record<string, string>>({})
  const [shortageMode, setShortageMode] = useState<Record<string, boolean>>({}) // وضع الاستلام بعجز لكل أمر
  const [receivedById, setReceivedById] = useState<Record<string, Record<string, string>>>({}) // received[unloadId][itemId]

  async function act(id: string, action: 'confirm' | 'cancel') {
    if (action === 'cancel' && !confirm('إلغاء أمر التفريغ ده؟ البضاعة مش هتدخل المخزن.')) return
    setBusy(id)
    setError('')
    // في وضع العجز نبعت الكميات المستلمة فعلاً لكل بند
    const received = action === 'confirm' && shortageMode[id]
      ? Object.entries(receivedById[id] || {}).map(([itemId, v]) => ({ itemId, receivedQty: Number(v) || 0 }))
      : undefined
    const res = await fetch(`/api/unload-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes: action === 'confirm' ? notesById[id] : undefined, received }),
    })
    setBusy('')
    if (!res.ok) return setError((await res.json()).error || 'حصل خطأ')
    const data = await res.json().catch(() => ({}))
    if (data.shortageValue > 0) alert(`اتعمل مذكرة عجز بقيمة ${Number(data.shortageValue).toLocaleString('ar-EG')} ج.م — اتحمّلت على المندوب واترفعت للخزينة.`)
    router.refresh()
  }

  const setReceived = (uid: string, itemId: string, v: string) =>
    setReceivedById((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), [itemId]: v } }))

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
                {!shortageMode[u.id] ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {u.items.map((it) => (
                      <span key={it.id} className={`text-xs px-2 py-0.5 rounded font-semibold tabular-nums ${it.kind === 'RETURN' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                        {it.name} {fmt(it.quantity)} {it.unit} — {it.kind === 'RETURN' ? 'مرتجع عميل' : 'بواقي بيع'}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-red-600">اكتب الكمية المستلمة فعلاً لكل صنف — الفرق يتحسب عجز ويتحمّل على المندوب:</p>
                    {u.items.map((it) => {
                      const recRaw = receivedById[u.id]?.[it.id]
                      const rec = recRaw === undefined || recRaw === '' ? it.quantity : Number(recRaw) || 0
                      const shortage = Math.max(0, it.quantity - rec)
                      return (
                        <div key={it.id} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 min-w-0 truncate">{it.name} <span className="text-gray-400">(مُعلَن {fmt(it.quantity)} {it.unit})</span></span>
                          <input type="text" inputMode="decimal" dir="ltr" value={recRaw ?? ''} onChange={(e) => setReceived(u.id, it.id, e.target.value)} placeholder={`مستلم (${fmt(it.quantity)})`} className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg tabular-nums text-xs" />
                          {shortage > 0 && <span className="text-red-600 font-semibold tabular-nums whitespace-nowrap">عجز {fmt(shortage)}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
                {u.items.some((it) => it.kind === 'RETURN') && (
                  <p className="text-[11px] text-orange-500 mt-1">فيه أصناف مرتجعة من عملاء — اتفصلت عن بواقي البيع العادية</p>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-col items-end gap-2 shrink-0 w-full sm:w-64">
                  <textarea
                    value={notesById[u.id] || ''}
                    onChange={(e) => setNotesById((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    placeholder="ملاحظات عن التفريغ/المرتجع (اختياري)"
                    rows={2}
                    className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShortageMode((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold border transition ${shortageMode[u.id] ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                  >
                    {shortageMode[u.id] ? 'رجوع لاستلام مطابق' : 'استلام مع وجود عجز'}
                  </button>
                  <div className="flex items-center gap-2 w-full">
                    <button
                      onClick={() => act(u.id, 'confirm')}
                      disabled={busy === u.id}
                      className={`flex-1 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 ${shortageMode[u.id] ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                      <PackageCheck className="w-4 h-4" /> {busy === u.id ? 'جارٍ...' : shortageMode[u.id] ? 'اعتماد الاستلام بالعجز' : 'موافقة استلام (مطابق)'}
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
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
