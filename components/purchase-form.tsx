'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  products: { id: string; name: string; unit: string }[]
  suppliers: { id: string; name: string }[]
}

export function PurchaseForm({ products, suppliers }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ productId: '', quantity: '', unitPrice: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const addItem = () => setItems([...items, { productId: '', quantity: '', unitPrice: '' }])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const validItems = items.filter((i) => i.productId && i.quantity && i.unitPrice)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))
    if (!supplierId || validItems.length === 0) {
      setError('اختار المورد وأدخل صنف واحد على الأقل')
      return
    }
    setLoading(true)
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, items: validItems, notes }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setSupplierId(''); setNotes(''); setItems([{ productId: '', quantity: '', unitPrice: '' }]); setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full bg-[#e94560] text-white py-3 rounded-xl font-semibold hover:bg-[#c73e54]">
        + فاتورة شراء جديدة
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-3">
      <h3 className="text-lg font-bold text-[#1a1a2e]">🛒 فاتورة شراء جديدة</h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]">
        <option value="">اختار المورد</option>
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف</label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <select value={item.productId} onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, productId: e.target.value } : it))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]">
              <option value="">الصنف</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" min="1" placeholder="الكمية" value={item.quantity}
              onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, quantity: e.target.value } : it))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
            <input type="number" min="0" step="0.01" placeholder="السعر" value={item.unitPrice}
              onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, unitPrice: e.target.value } : it))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-sm text-[#0f3460] font-medium">+ إضافة صنف</button>
      </div>
      <input placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
      <div className="flex gap-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-[#e94560] text-white py-2 rounded-lg font-semibold hover:bg-[#c73e54] disabled:opacity-50">
          {loading ? 'جاري...' : 'حفظ'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">إلغاء</button>
      </div>
    </form>
  )
}
