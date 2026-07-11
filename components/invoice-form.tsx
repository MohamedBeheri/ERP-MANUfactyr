'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  customers: { id: string; name: string }[]
  products: { id: string; name: string; unit: string; sellPrice: number; quantity: number }[]
}

export function InvoiceForm({ customers, products }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [type, setType] = useState<'CASH' | 'CREDIT'>('CASH')
  const [discount, setDiscount] = useState('0')
  const [items, setItems] = useState([{ productId: '', quantity: '', unitPrice: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const addItem = () => setItems([...items, { productId: '', quantity: '', unitPrice: '' }])

  const updateItem = (i: number, field: string, value: string) => {
    setItems(items.map((it, j) => {
      if (j !== i) return it
      if (field === 'productId') {
        const p = products.find((pr) => pr.id === value)
        return { ...it, productId: value, unitPrice: p ? String(p.sellPrice) : it.unitPrice }
      }
      return { ...it, [field]: value }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const validItems = items.filter((i) => i.productId && i.quantity && i.unitPrice)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))
    if (!customerId || validItems.length === 0) {
      setError('اختار عميل وأدخل صنف واحد على الأقل')
      return
    }
    setLoading(true)
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, items: validItems, type, discount: Number(discount) || 0 }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setCustomerId(''); setItems([{ productId: '', quantity: '', unitPrice: '' }]); setDiscount('0'); setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full bg-[#0f3460] text-white py-3 rounded-xl font-semibold hover:bg-[#0a2545]">
        + فاتورة بيع جديدة
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-3">
      <h3 className="text-lg font-bold text-[#1a1a2e]">🧾 فاتورة بيع جديدة</h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]">
        <option value="">اختار العميل</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={type} onChange={(e) => setType(e.target.value as 'CASH' | 'CREDIT')}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]">
        <option value="CASH">نقدي</option>
        <option value="CREDIT">آجل</option>
      </select>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف</label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <select value={item.productId} onChange={(e) => updateItem(i, 'productId', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]">
              <option value="">الصنف</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.quantity})</option>)}
            </select>
            <input type="number" min="1" placeholder="كمية" value={item.quantity}
              onChange={(e) => updateItem(i, 'quantity', e.target.value)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
            <input type="number" min="0" step="0.01" placeholder="سعر" value={item.unitPrice}
              onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-sm text-[#0f3460] font-medium">+ إضافة صنف</button>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">نسبة الخصم %</label>
        <input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
      </div>
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
