'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Factory, Plus, X } from 'lucide-react'

interface Props {
  rawProducts: { id: string; name: string; quantity: number; unit: string }[]
  finishedProducts: { id: string; name: string; unit: string }[]
}

const STAGES = ['تحميص', 'طحن', 'تحميص وطحن', 'تعبئة']

export function ProductionForm({ rawProducts, finishedProducts }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rawProductId, setRawProductId] = useState('')
  const [rawUsed, setRawUsed] = useState('')
  const [stage, setStage] = useState('تحميص وطحن')
  const [opCost, setOpCost] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ productId: '', quantity: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedRaw = rawProducts.find((p) => p.id === rawProductId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const validItems = items
      .filter((i) => i.productId && i.quantity)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }))
    if (!rawProductId || !rawUsed || validItems.length === 0) {
      setError('اختار الخامة وأدخل الكمية والمنتجات الناتجة')
      return
    }
    setLoading(true)
    const res = await fetch('/api/production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawProductId,
        rawUsed: Number(rawUsed),
        stage,
        opCost: Number(opCost) || 0,
        items: validItems,
        notes,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setRawProductId(''); setRawUsed(''); setOpCost(''); setNotes(''); setItems([{ productId: '', quantity: '' }]); setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-[#0f3460] text-white py-3 rounded-xl font-semibold hover:bg-[#0a2545] transition-colors"
      >
        <Factory className="w-5 h-5" />
        أمر تصنيع جديد
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
      <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
        <Factory className="w-5 h-5 text-[#0f3460]" />
        أمر تصنيع جديد
      </h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">الخامة (البن الأخضر)</label>
        <select
          value={rawProductId}
          onChange={(e) => setRawProductId(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        >
          <option value="">اختار نوع البن الخام</option>
          {rawProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (متاح: {p.quantity} {p.unit})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">الكمية المستخدمة</label>
          <input
            type="number" min="1" max={selectedRaw?.quantity}
            value={rawUsed}
            onChange={(e) => setRawUsed(e.target.value)}
            placeholder={selectedRaw ? `حتى ${selectedRaw.quantity}` : 'كجم'}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">المرحلة</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
          >
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">المنتجات الناتجة</label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <select
              value={item.productId}
              onChange={(e) => setItems(items.map((it, j) => (j === i ? { ...it, productId: e.target.value } : it)))}
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
            >
              <option value="">اختار المنتج</option>
              {finishedProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input
              type="number" min="1" placeholder="الكمية"
              value={item.quantity}
              onChange={(e) => setItems(items.map((it, j) => (j === i ? { ...it, quantity: e.target.value } : it)))}
              className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
            />
            {items.length > 1 && (
              <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="px-2 text-red-500">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, { productId: '', quantity: '' }])}
          className="flex items-center gap-1 text-sm text-[#0f3460] font-medium"
        >
          <Plus className="w-4 h-4" /> إضافة منتج
        </button>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">تكلفة التشغيل (ج.م)</label>
        <input
          type="number" min="0" step="0.01"
          value={opCost}
          onChange={(e) => setOpCost(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        />
      </div>

      <input
        placeholder="ملاحظات (اختياري)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
      />

      <div className="flex gap-2">
        <button
          type="submit" disabled={loading}
          className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50"
        >
          {loading ? 'جاري الحفظ...' : 'تنفيذ أمر التصنيع'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          إلغاء
        </button>
      </div>
    </form>
  )
}
