'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  rawProducts: { id: string; name: string; quantity: number; unit: string }[]
  finishedProducts: { id: string; name: string; unit: string }[]
}

export function ProductionForm({ rawProducts, finishedProducts }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rawUsed, setRawUsed] = useState('')
  const [opCost, setOpCost] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ productId: '', quantity: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const addItem = () => setItems([...items, { productId: '', quantity: '' }])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const validItems = items.filter((i) => i.productId && i.quantity).map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }))
    if (!rawUsed || validItems.length === 0) {
      setError('أدخل كمية الخام المستخدم وصنف واحد على الأقل')
      return
    }
    setLoading(true)
    const res = await fetch('/api/production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawUsed: Number(rawUsed), opCost: Number(opCost) || 0, items: validItems, notes }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setRawUsed(''); setOpCost(''); setNotes(''); setItems([{ productId: '', quantity: '' }]); setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full bg-[#0f3460] text-white py-3 rounded-xl font-semibold hover:bg-[#0a2545]">
        + أمر تصنيع جديد
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-3">
      <h3 className="text-lg font-bold text-[#1a1a2e]">📦 أمر تصنيع جديد</h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">كمية الخام المستخدم (كجم)</label>
        <input type="number" min="1" value={rawUsed} onChange={(e) => setRawUsed(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
          placeholder={rawProducts.length > 0 ? `متاح: ${rawProducts[0].quantity} ${rawProducts[0].unit}` : ''} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">تكلفة التشغيل (ج.م)</label>
        <input type="number" min="0" step="0.01" value={opCost} onChange={(e) => setOpCost(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">المنتجات الناتجة</label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <select value={item.productId} onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, productId: e.target.value } : it))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]">
              <option value="">اختار المنتج</option>
              {finishedProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" min="1" placeholder="الكمية" value={item.quantity}
              onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, quantity: e.target.value } : it))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-sm text-[#0f3460] font-medium">+ إضافة منتج</button>
      </div>
      <input placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
      <div className="flex gap-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-[#0f3460] text-white py-2 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50">
          {loading ? 'جاري...' : 'حفظ'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">إلغاء</button>
      </div>
    </form>
  )
}
