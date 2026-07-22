'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, X } from 'lucide-react'

interface ProductRow {
  id: string
  name: string
  unit: string
  stocksByWarehouse: Record<string, number>
}

interface WarehouseOption {
  id: string
  name: string
  isDefault: boolean
}

export function StocktakeForm({ products, warehouses }: { products: ProductRow[]; warehouses: WarehouseOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '')
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [showRecorded, setShowRecorded] = useState(false) // جرد أعمى افتراضيًا — الرقم المسجّل مخفي
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const recordedOf = (p: ProductRow) => p.stocksByWarehouse[warehouseId] ?? 0

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
      body: JSON.stringify({ items, notes, warehouseId }),
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
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
          <X className="w-5 h-5" />
        </button>
      </div>

      {warehouses.length > 1 && (
        <select
          value={warehouseId}
          onChange={(e) => { setWarehouseId(e.target.value); setCounts({}) }}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm font-semibold"
        >
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>جرد: {w.name}</option>
          ))}
        </select>
      )}

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-500 flex-1">
          عُدّ الكمية الفعلية واكتبها — الرقم المسجّل مخفي عشان الجرد يبقى دقيق. الفرق هيتسوى تلقائي بإذن إضافة أو صرف. سيب الخانة فاضية لو الصنف مش داخل في الجرد.
        </p>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 shrink-0 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showRecorded} onChange={(e) => setShowRecorded(e.target.checked)} className="w-3.5 h-3.5" />
          إظهار المسجّل
        </label>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{success}</div>}

      <div className="max-h-80 overflow-y-auto space-y-2 pl-1">
        {products.map((p) => {
          const recorded = recordedOf(p)
          const counted = counts[p.id]
          const diff = counted !== undefined && counted !== '' ? Number(counted) - recorded : null
          return (
            <div key={p.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-gray-400 tabular-nums">
                  {showRecorded ? `مسجّل: ${recorded} ${p.unit}` : `الوحدة: ${p.unit}`}
                </p>
              </div>
              {showRecorded && diff !== null && diff !== 0 && (
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
                className="w-24 shrink-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm tabular-nums"
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
