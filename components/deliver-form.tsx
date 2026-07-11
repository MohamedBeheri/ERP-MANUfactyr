'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Customer {
  id: string
  name: string
}

interface RemainingItem {
  productId: string
  productName: string
  unit: string
  sellPrice: number
  remaining: number
}

export function DeliverForm({
  deliveryOrderId,
  customers,
  remainingItems,
}: {
  deliveryOrderId: string
  customers: Customer[]
  remainingItems: RemainingItem[]
}) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [type, setType] = useState<'CASH' | 'CREDIT'>('CASH')
  const [rows, setRows] = useState([{ productId: '', quantity: '', unitPrice: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const addRow = () => setRows([...rows, { productId: '', quantity: '', unitPrice: '' }])
  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index))
  const updateRow = (index: number, field: 'productId' | 'quantity' | 'unitPrice', value: string) => {
    setRows(
      rows.map((row, i) => {
        if (i !== index) return row
        if (field === 'productId') {
          const product = remainingItems.find((p) => p.productId === value)
          return { ...row, productId: value, unitPrice: product ? String(product.sellPrice) : row.unitPrice }
        }
        return { ...row, [field]: value }
      })
    )
  }

  const availableItems = remainingItems.filter((item) => item.remaining > 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    let finalCustomerId = customerId

    const items = rows
      .filter((r) => r.productId && r.quantity && r.unitPrice)
      .map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) }))

    if ((!customerId && !newCustomerName) || items.length === 0) {
      setError('اختار عميل أو اكتب اسم عميل جديد، وصنف واحد على الأقل')
      return
    }

    setLoading(true)

    if (!finalCustomerId && newCustomerName) {
      const customerRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName, type }),
      })
      const customerData = await customerRes.json()
      if (!customerRes.ok) {
        setLoading(false)
        setError(customerData.error || 'حصل خطأ في إضافة العميل')
        return
      }
      finalCustomerId = customerData.id
    }

    const res = await fetch(`/api/delivery-orders/${deliveryOrderId}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: finalCustomerId, items, type }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'حصل خطأ')
      return
    }

    setCustomerId('')
    setNewCustomerName('')
    setRows([{ productId: '', quantity: '', unitPrice: '' }])
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
      <h3 className="text-lg font-bold text-[#1a1a2e]">📍 تسليم لعميل</h3>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">العميل</label>
        <select
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value)
            if (e.target.value) setNewCustomerName('')
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] mb-2"
        >
          <option value="">اختار عميل موجود</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="أو اكتب اسم عميل جديد"
          value={newCustomerName}
          onChange={(e) => {
            setNewCustomerName(e.target.value)
            if (e.target.value) setCustomerId('')
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الدفع</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'CASH' | 'CREDIT')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        >
          <option value="CASH">نقدي</option>
          <option value="CREDIT">آجل</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف</label>
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <select
              value={row.productId}
              onChange={(e) => updateRow(index, 'productId', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
            >
              <option value="">اختار الصنف</option>
              {availableItems.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.productName} (متبقي: {p.remaining} {p.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="الكمية"
              value={row.quantity}
              onChange={(e) => updateRow(index, 'quantity', e.target.value)}
              className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="السعر"
              value={row.unitPrice}
              onChange={(e) => updateRow(index, 'unitPrice', e.target.value)}
              className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
            />
            {rows.length > 1 && (
              <button type="button" onClick={() => removeRow(index)} className="px-3 text-red-500">
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addRow} className="text-sm text-[#0f3460] font-medium">
          + إضافة صنف
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0f3460] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2545] transition-colors disabled:opacity-50"
      >
        {loading ? 'جاري التسليم...' : 'تسجيل التسليم'}
      </button>
    </form>
  )
}
