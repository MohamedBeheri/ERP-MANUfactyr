'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, X } from 'lucide-react'

interface ProductRow {
  id: string
  name: string
  quantity: number
  unit: string
  type: string
}

export function StocktakeForm({ products }: { products: ProductRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const items = Object.entries(counts)
      .filter(([, v]) => v !== '')
      .map(([productId, v]) => ({ productId, countedQty: Number(v) }))

    if (items.length === 0) {
      setError('أدخل الكمية الفعلية لصنف واحد على الأقل')
      return
    }

    setLoading(true)
    const res = await fetch('/api/warehouse/stocktake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, notes }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'حصل خطأ')
      return
    }

    setSuccess(data.adjusted === 0 ? 'مفيش فروقات — المخزون مطابق ✓' : `تمت تسوية ${data.adjusted} صنف`)
    setCounts({})
    setNotes('')
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-[#e94560] text-white py-3 rounded-xl font-semibold hover:bg-[#c73e54] transition-colors"
      >
        <ClipboardCheck className="w-5 h-5" />
        بدء جرد المخزن
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[#e94560]" />
          جرد المخزن
        </h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-gray-500">
        أدخل الكمية الفعلية اللي اتعدّت — الفرق هيتسوى تلقائي بإذن إضافة أو صرف. سيب الخانة فاضية لو الصنف مش داخل في الجرد.
      </p>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{success}</div>}

      <div className="max-h-80 overflow-y-auto space-y-2 pl-1">
        {products.map((p) => {
          const counted = counts[p.id]
          const diff = counted !== undefined && counted !== '' ? Number(counted) - p.quantity : null
          return (
            <div key={p.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-gray-400 tabular-nums">مسجّل: {p.quantity} {p.unit}</p>
              </div>
              {diff !== null && diff !== 0 && (
                <span className={`text-xs font-bold tabular-nums ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              )}
              <input
                type="number"
                min="0"
                placeholder="الفعلي"
                value={counted || ''}
                onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm tabular-nums"
              />
            </div>
          )
        })}
      </div>

      <input
        placeholder="ملاحظات الجرد (اختياري)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#e94560] text-white py-2.5 rounded-lg font-semibold hover:bg-[#c73e54] disabled:opacity-50"
      >
        {loading ? 'جاري التسوية...' : 'اعتماد الجرد وتسوية الفروقات'}
      </button>
    </form>
  )
}
