'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, X } from 'lucide-react'
import { DeliveryOrderForm } from '@/components/delivery-order-form'

interface Delegate { id: string; name: string; carNumber: string | null }
interface Product { id: string; name: string; unit: string; stocksByWarehouse: Record<string, number> }
interface WarehouseOption { id: string; name: string; isDefault: boolean }
interface OrderData {
  id: string; orderNo: string; delegateId: string; warehouseId: string; notes: string
  items: { productId: string; quantity: number }[]
}

// أزرار تعديل/حذف أمر التحميل — بتظهر بس للأوامر المعلّقة (قبل ما المندوب يأكّد الاستلام ويتحرك)
export function LoadRowActions({ order, delegates, products, warehouses }: {
  order: OrderData
  delegates: Delegate[]
  products: Product[]
  warehouses: WarehouseOption[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const doDelete = async () => {
    setBusy(true); setErr('')
    const res = await fetch(`/api/delivery-orders/${order.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || 'فشل الحذف'); return }
    setDeleting(false); router.refresh()
  }

  return (
    <>
      <button onClick={() => setEditing(true)} className="shrink-0 p-2 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg" title="تعديل أمر التحميل" aria-label="تعديل">
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={() => setDeleting(true)} className="shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="حذف أمر التحميل" aria-label="حذف">
        <Trash2 className="w-4 h-4" />
      </button>

      {/* مودال التعديل */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg mt-8">
            <div className="flex justify-end mb-1">
              <button onClick={() => setEditing(false)} className="p-2 bg-white rounded-full shadow" aria-label="إغلاق"><X className="w-4 h-4" /></button>
            </div>
            <DeliveryOrderForm
              delegates={delegates}
              products={products}
              warehouses={warehouses}
              editOrder={{ id: order.id, delegateId: order.delegateId, warehouseId: order.warehouseId, notes: order.notes, items: order.items }}
              onDone={() => setEditing(false)}
            />
          </div>
        </div>
      )}

      {/* تأكيد الحذف */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <h4 className="font-bold text-[#1a1a2e]">حذف أمر التحميل {order.orderNo}؟</h4>
            <p className="text-sm text-gray-500">الأمر لسه معلّق والبضاعة ما خرجتش من المخزن — الحذف مفيهوش أي أثر على المخزون.</p>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button onClick={doDelete} disabled={busy} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50">{busy ? 'جاري...' : 'حذف'}</button>
              <button onClick={() => { setDeleting(false); setErr('') }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
