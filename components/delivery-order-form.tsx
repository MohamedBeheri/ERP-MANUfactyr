'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/searchable-select'

interface Delegate {
  id: string
  name: string
  carNumber: string | null
}

interface Product {
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

interface EditOrder { id: string; delegateId: string; warehouseId: string; notes: string; items: { productId: string; quantity: number }[] }

export function DeliveryOrderForm({
  delegates,
  products,
  warehouses = [],
  editOrder,
  onDone,
}: {
  delegates: Delegate[]
  products: Product[]
  warehouses?: WarehouseOption[]
  editOrder?: EditOrder
  onDone?: () => void
}) {
  const router = useRouter()
  const isEdit = !!editOrder
  const [delegateId, setDelegateId] = useState(editOrder?.delegateId || '')
  const [warehouseId, setWarehouseId] = useState(editOrder?.warehouseId || warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '')
  const [rows, setRows] = useState<{ productId: string; quantity: string }[]>(
    editOrder?.items.length ? editOrder.items.map((i) => ({ productId: i.productId, quantity: String(i.quantity) })) : [{ productId: '', quantity: '' }]
  )
  const [notes, setNotes] = useState(editOrder?.notes || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // أصناف المخزن المختار بس (متاح > 0) — التحميل بيسحب من رصيد المخزن ده فعليًا
  // في وضع التعديل بنضمّن الأصناف المختارة أصلًا حتى لو رصيدها ظهر 0 عشان متختفيش
  const stockOf = (p: Product) => p.stocksByWarehouse[warehouseId] ?? 0
  const selectedIds = new Set(rows.map((r) => r.productId).filter(Boolean))
  const availableProducts = products.filter((p) => stockOf(p) > 0 || (isEdit && selectedIds.has(p.id)))

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
    const res = await fetch(isEdit ? `/api/delivery-orders/${editOrder!.id}` : '/api/delivery-orders', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delegateId, items, notes, warehouseId }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'حصل خطأ')
      return
    }

    if (isEdit) { router.refresh(); onDone?.(); return }
    setDelegateId('')
    setRows([{ productId: '', quantity: '' }])
    setNotes('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
      <h3 className="text-lg font-bold text-[#1a1a2e]">{isEdit ? `تعديل أمر التحميل` : 'تحميل عربية جديدة'}</h3>
      {isEdit && <p className="text-xs text-amber-600">التعديل بيلغي تجهيز المخزن السابق — لازم يتجهّز تاني على الكميات الجديدة.</p>}

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
            onChange={(e) => { setWarehouseId(e.target.value); setRows([{ productId: '', quantity: '' }]) }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          الأصناف والكميات {warehouseId && <span className="font-normal text-gray-400">— أصناف {warehouses.find((w) => w.id === warehouseId)?.name} بس</span>}
        </label>
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <div className="flex-1 min-w-0">
              <SearchableSelect
                value={row.productId}
                onChange={(v) => updateRow(index, 'productId', v)}
                placeholder="اختار الصنف"
                emptyText="مفيش أصناف متاحة في المخزن ده"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                options={availableProducts.map((p) => ({ value: p.id, label: p.name, sublabel: `متاح ${stockOf(p)} ${p.unit}` }))}
              />
            </div>
            <input
              type="text" inputMode="decimal" dir="ltr"
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-[#0f3460] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2545] transition-colors disabled:opacity-50"
        >
          {loading ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديل' : 'تحميل العربية'}
        </button>
        {isEdit && onDone && (
          <button type="button" onClick={onDone} className="px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-semibold">إلغاء</button>
        )}
      </div>
    </form>
  )
}
