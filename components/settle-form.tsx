'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RemainingItem {
  productId: string
  productName: string
  unit: string
  remaining: number
}

export function SettleForm({
  deliveryOrderId,
  remainingItems,
}: {
  deliveryOrderId: string
  remainingItems: RemainingItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [returns, setReturns] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const remaining = remainingItems.filter((item) => item.remaining > 0)

  const submit = async (returnItems: { productId: string; quantity: number }[]) => {
    setLoading(true); setError('')
    const res = await fetch(`/api/delivery-orders/${deliveryOrderId}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returns: returnItems, notes }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    router.refresh()
  }

  // تسوية تلقائية: كل المتبقي على العربية بيترجع بالكامل (مفيش عجز) — بضغطة واحدة
  const autoSettle = () => {
    if (!confirm('تسوية تلقائية: هيتحسب المباع والمحصّل والعمولة تلقائي، والمرتجع = كل المتبقي على العربية. تمام؟')) return
    submit(remaining.map((i) => ({ productId: i.productId, quantity: i.remaining })))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const returnItems = Object.entries(returns).filter(([, qty]) => qty).map(([productId, qty]) => ({ productId, quantity: Number(qty) }))
    submit(returnItems)
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-sm">{error}</div>}
        <button
          onClick={autoSettle}
          disabled={loading}
          className="w-full bg-[#e94560] text-white py-3 rounded-lg font-semibold hover:bg-[#c73e54] transition-colors disabled:opacity-50"
        >
          {loading ? 'جاري التسوية...' : 'تسوية نهاية اليوم تلقائيًا'}
        </button>
        <button
          onClick={() => setOpen(true)}
          className="w-full text-gray-500 text-sm py-1.5 hover:text-[#0f3460]"
        >
          أو تعديل المرتجع يدويًا (لو فيه عجز/جرد مختلف)
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
      <h3 className="text-lg font-bold text-[#1a1a2e]">تسوية نهاية اليوم — الكمية المرتجعة</h3>
      <p className="text-sm text-gray-500">
        المباع والمحصّل بيتحسبوا تلقائي من التسليمات المسجّلة. هنا بس أدخل الكمية المرتجعة الفعلية (جرد) لكل صنف.
      </p>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <div className="space-y-2">
        {remainingItems
          .filter((item) => item.remaining > 0)
          .map((item) => (
            <div key={item.productId} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">
                {item.productName} (متبقي على العربية: {item.remaining} {item.unit})
              </span>
              <input
                type="text" inputMode="decimal" dir="ltr"
                min="0"
                max={item.remaining}
                placeholder="0"
                value={returns[item.productId] || ''}
                onChange={(e) => setReturns({ ...returns, [item.productId]: e.target.value })}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
              />
            </div>
          ))}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">ملاحظات</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-[#e94560] text-white py-3 rounded-lg font-semibold hover:bg-[#c73e54] disabled:opacity-50"
        >
          {loading ? 'جاري التسوية...' : 'تأكيد التسوية'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          إلغاء
        </button>
      </div>
    </form>
  )
}
