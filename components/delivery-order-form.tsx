'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Delegate {
  id: string
  name: string
  carNumber: string | null
}

interface Product {
  id: string
  name: string
  unit: string
  quantity: number
}

interface WarehouseOption {
  id: string
  name: string
  isDefault: boolean
}

export function DeliveryOrderForm({
  delegates,
  products,
  warehouses = [],
}: {
  delegates: Delegate[]
  products: Product[]
  warehouses?: WarehouseOption[]
}) {
  const router = useRouter()
  const [delegateId, setDelegateId] = useState('')
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '')
  const [rows, setRows] = useState([{ productId: '', quantity: '' }])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const addRow = () => setRows([...rows, { productId: '', quantity: '' }])
  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index))
  const updateRow = (index: number, field: 'productId' | 'quantity', value: string) => {
    setRows(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const items = rows
      .filter((r) => r.productId && r.quantity)
      .map((r) => ({ productId: r.productId, quantity: Number(r.quantity) }))

    if (!delegateId || items.length === 0) {
      setError('اختار المندوب وصنف واحد على الأقل')
      return
    }

    setLoading(true)
    const res = await fetch('/api/delivery-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delegateId, items, notes, warehouseId }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'حصل خطأ')
      return
    }

    setDelegateId('')
    setRows([{ productId: '', quantity: '' }])
    setNotes('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
      <h3 className="text-lg font-bold text-[#1a1a2e]">تحميل عربية جديدة</h3>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">المندوب</label>
        <select
          value={delegateId}
          onChange={(e) => setDelegateId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        >
          <option value="">اختار المندوب</option>
          {delegates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.carNumber ? `- ${d.carNumber}` : ''}
            </option>
          ))}
        </select>
      </div>

      {warehouses.length > 1 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">التحميل من مخزن</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف والكميات</label>
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <select
              value={row.productId}
              onChange={(e) => updateRow(index, 'productId', e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
            >
              <option value="">اختار الصنف</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (متاح: {p.quantity} {p.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="الكمية"
              value={row.quantity}
              onChange={(e) => updateRow(index, 'quantity', e.target.value)}
              className="w-20 shrink-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm tabular-nums"
            />
            {rows.length > 1 && (
              <button type="button" onClick={() => removeRow(index)} className="shrink-0 px-2 text-red-500">
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addRow} className="text-sm text-[#0f3460] font-medium">
          + إضافة صنف
        </button>
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

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0f3460] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2545] transition-colors disabled:opacity-50"
      >
        {loading ? 'جاري التحميل...' : 'تحميل العربية'}
      </button>
    </form>
  )
}
