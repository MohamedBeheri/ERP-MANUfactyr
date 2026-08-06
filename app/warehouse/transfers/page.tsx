'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeftRight, Check, X, Loader2, Plus, Package, ArrowRight } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { SearchableSelect } from '@/components/searchable-select'

interface Warehouse { id: string; name: string }
interface Product { id: string; name: string; unit: string; stocks: { warehouseId: string; quantity: number }[] }
interface Transfer {
  id: string; transferNo: string; quantity: number; reason: string; notes?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED'
  createdAt: string; executedAt?: string
  fromWarehouse: { id: string; name: string }
  toWarehouse: { id: string; name: string }
  product: { id: string; name: string; unit: string }
  creator: { name: string }
  approvedBy?: { name: string }
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'قيد الانتظار', cls: 'bg-yellow-50 text-yellow-700' },
  APPROVED: { label: 'معتمد', cls: 'bg-blue-50 text-blue-700' },
  EXECUTED: { label: 'تم التنفيذ', cls: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'مرفوض', cls: 'bg-red-50 text-red-700' },
}

export default function StockTransfersPage() {
  const { can } = usePermissions()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [fromWarehouseId, setFromWarehouseId] = useState('')
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const [whRes, prRes, trRes] = await Promise.all([
      fetch('/api/warehouses'), fetch('/api/products'), fetch('/api/stock-transfers'),
    ])
    const [wh, pr, tr] = await Promise.all([whRes.json(), prRes.json(), trRes.json()])
    setWarehouses(wh)
    setProducts(pr)
    setTransfers(tr)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const availableStock = fromWarehouseId && productId
    ? products.find(p => p.id === productId)?.stocks?.find(s => s.warehouseId === fromWarehouseId)?.quantity ?? 0
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromWarehouseId, toWarehouseId, productId, quantity: +quantity, reason, notes }),
    })
    if (res.ok) {
      setShowForm(false)
      setFromWarehouseId(''); setToWarehouseId(''); setProductId(''); setQuantity(''); setReason(''); setNotes('')
      load()
    } else {
      const data = await res.json()
      alert(data.error || 'حدث خطأ')
    }
    setSubmitting(false)
  }

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !confirm('هل تريد رفض هذا التحويل؟')) return
    setActionLoading(id)
    const res = await fetch(`/api/stock-transfers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'حدث خطأ')
    }
    await load()
    setActionLoading(null)
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) return <div className="flex items-center justify-center h-dvh"><Loader2 className="w-8 h-8 animate-spin text-[#0f3460]" /></div>

  return (
    <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-[#0f3460]" />
              تحويلات المخازن
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">نقل الأصناف بين المخازن مع التتبع والحوكمة</p>
          </div>
          {can('warehouse', 'add') && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0f3460] text-white rounded-xl text-sm font-semibold hover:bg-[#0a2540] transition-colors"
            >
              <Plus className="w-4 h-4" />
              تحويل جديد
            </button>
          )}
        </div>

        {/* Transfer Form */}
        {showForm && can('warehouse', 'add') && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-base font-bold text-[#1a1a2e]">طلب تحويل مخزني</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">من مخزن</label>
                <select value={fromWarehouseId} onChange={e => setFromWarehouseId(e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0f3460] outline-none">
                  <option value="">اختر المخزن المصدر</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">إلى مخزن</label>
                <select value={toWarehouseId} onChange={e => setToWarehouseId(e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0f3460] outline-none">
                  <option value="">اختر المخزن الوجهة</option>
                  {warehouses.filter(w => w.id !== fromWarehouseId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الصنف</label>
                <SearchableSelect
                  value={productId}
                  onChange={setProductId}
                  placeholder="اختر الصنف"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0f3460] outline-none"
                  options={products.map((p) => ({ value: p.id, label: p.name }))}
                />
                {availableStock !== null && (
                  <p className="text-[11px] text-gray-400 mt-1">الرصيد المتاح: <span className="font-bold text-[#1a1a2e]">{availableStock}</span></p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الكمية</label>
                <input type="text" inputMode="decimal" dir="ltr" min={1} max={availableStock ?? undefined} value={quantity} onChange={e => setQuantity(e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0f3460] outline-none" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">سبب التحويل</label>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0f3460] outline-none" placeholder="مثال: تغطية نقص مخزن الفرع" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ملاحظات (اختياري)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0f3460] outline-none" placeholder="ملاحظات إضافية" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0f3460] text-white rounded-xl text-sm font-semibold hover:bg-[#0a2540] disabled:opacity-50 transition-colors">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                إنشاء طلب تحويل
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">إلغاء</button>
            </div>
          </form>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي التحويلات', value: transfers.length, cls: 'text-[#0f3460]' },
            { label: 'قيد الانتظار', value: transfers.filter(t => t.status === 'PENDING').length, cls: 'text-yellow-600' },
            { label: 'تم التنفيذ', value: transfers.filter(t => t.status === 'EXECUTED').length, cls: 'text-green-600' },
            { label: 'مرفوض', value: transfers.filter(t => t.status === 'REJECTED').length, cls: 'text-red-600' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-xl font-bold tabular-nums ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Transfers Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Package className="w-5 h-5 text-[#0f3460]" />
            <h3 className="text-base font-bold text-[#1a1a2e]">سجل التحويلات</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                  <th className="p-3 font-medium">رقم التحويل</th>
                  <th className="p-3 font-medium">الصنف</th>
                  <th className="p-3 font-medium">من → إلى</th>
                  <th className="p-3 font-medium">الكمية</th>
                  <th className="p-3 font-medium">السبب</th>
                  <th className="p-3 font-medium text-center">الحالة</th>
                  <th className="p-3 font-medium">بواسطة</th>
                  <th className="p-3 font-medium">التاريخ</th>
                  <th className="p-3 font-medium text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-400">لا توجد تحويلات بعد</td></tr>
                )}
                {transfers.map(t => {
                  const st = STATUS_MAP[t.status]
                  return (
                    <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="p-3 font-mono text-xs font-semibold text-[#0f3460]">{t.transferNo}</td>
                      <td className="p-3 font-semibold">{t.product.name}</td>
                      <td className="p-3">
                        <span className="text-xs flex items-center gap-1.5 flex-wrap">
                          <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">{t.fromWarehouse.name}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-semibold">{t.toWarehouse.name}</span>
                        </span>
                      </td>
                      <td className="p-3 font-bold tabular-nums">{t.quantity} <span className="text-gray-400 font-normal">{t.product.unit}</span></td>
                      <td className="p-3 text-gray-600 text-xs max-w-[200px] truncate">{t.reason}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="p-3 text-xs text-gray-500">{t.creator.name}</td>
                      <td className="p-3 text-xs text-gray-500 tabular-nums whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                      <td className="p-3 text-center">
                        {t.status === 'PENDING' && can('warehouse', 'edit') && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleAction(t.id, 'approve')}
                              disabled={actionLoading === t.id}
                              className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                              title="موافقة وتنفيذ"
                            >
                              {actionLoading === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleAction(t.id, 'reject')}
                              disabled={actionLoading === t.id}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                              title="رفض"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {t.status === 'EXECUTED' && t.approvedBy && (
                          <span className="text-[10px] text-gray-400">بواسطة {t.approvedBy.name}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  )
}
