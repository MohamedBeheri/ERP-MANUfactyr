'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface WarehouseOption { id: string; name: string; isDefault: boolean }
interface Props {
  products: { id: string; name: string; unit: string }[]
  suppliers: { id: string; name: string }[]
  warehouses?: WarehouseOption[]
}

const PAY_METHODS = ['نقدي فوري', 'آجل', 'نقدي جزئي'] as const
const inputCls = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

// ضغط صورة الفاتورة لـ data URL
function fileToDataUrl(file: File, maxSize = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', 0.75))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function PurchaseForm({ products, suppliers, warehouses = [] }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [payMethod, setPayMethod] = useState<(typeof PAY_METHODS)[number]>('نقدي فوري')
  const [paidAmount, setPaidAmount] = useState('')
  const [invoiceImage, setInvoiceImage] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ productId: '', quantity: '', unitPrice: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)
  const paid = payMethod === 'آجل' ? 0 : payMethod === 'نقدي جزئي' ? Math.min(total, Number(paidAmount) || 0) : total
  const owed = total - paid

  const handleImage = async (file?: File) => {
    if (!file) return
    try { setInvoiceImage(await fileToDataUrl(file)) } catch { setError('فشل تحميل الصورة') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const validItems = items.filter((i) => i.productId && i.quantity && i.unitPrice)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))
    if (!supplierId || validItems.length === 0) { setError('اختار المورد وأدخل صنف واحد على الأقل'); return }
    if (payMethod === 'نقدي جزئي' && !(Number(paidAmount) > 0)) { setError('اكتب المبلغ المدفوع في الدفع الجزئي'); return }
    setLoading(true)
    const res = await fetch('/api/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId, supplierInvoiceNo, items: validItems, notes, warehouseId,
        paymentMethod: payMethod, paidAmount: payMethod === 'نقدي جزئي' ? Number(paidAmount) : undefined,
        invoiceImage: invoiceImage || undefined,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setSupplierId(''); setSupplierInvoiceNo(''); setNotes(''); setPayMethod('نقدي فوري'); setPaidAmount(''); setInvoiceImage('')
    setItems([{ productId: '', quantity: '', unitPrice: '' }]); setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full bg-[#e94560] text-white py-3 rounded-xl font-semibold hover:bg-[#c73e54]">
        + أمر شراء جديد
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-3">
      <h3 className="text-lg font-bold text-[#1a1a2e]">أمر شراء جديد</h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
          <option value="">اختار المورد</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input placeholder="رقم فاتورة المورد الورقية" value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} className={inputCls} />
      </div>

      {warehouses.length > 0 && (
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
          <option value="">التوريد لمخزن: تلقائي (حسب الصنف)</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>توريد لـ {w.name}</option>)}
        </select>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الأصناف</label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <select value={item.productId} onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, productId: e.target.value } : it))} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">الصنف</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" min="1" placeholder="الكمية" value={item.quantity} onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, quantity: e.target.value } : it))} className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input type="number" min="0" step="0.01" placeholder="السعر" value={item.unitPrice} onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, unitPrice: e.target.value } : it))} className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, { productId: '', quantity: '', unitPrice: '' }])} className="text-sm text-[#0f3460] font-medium">+ إضافة صنف</button>
      </div>

      {/* الدفع للمورد */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <label className="block text-sm font-semibold text-gray-700">الدفع للمورد</label>
        <div className="flex gap-1.5">
          {PAY_METHODS.map((m) => (
            <button key={m} type="button" onClick={() => setPayMethod(m)} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition ${payMethod === m ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600'}`}>{m}</button>
          ))}
        </div>
        {payMethod === 'نقدي جزئي' && (
          <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="المبلغ المدفوع للمورد دلوقتي" className={inputCls} />
        )}
        {total > 0 && (
          <div className="bg-gray-50 rounded-lg p-2.5 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">إجمالي الفاتورة</span><span className="font-semibold tabular-nums">{total.toLocaleString('ar-EG')} ج.م</span></div>
            <div className="flex justify-between"><span className="text-gray-500">المدفوع</span><span className="font-semibold tabular-nums text-green-700">{paid.toLocaleString('ar-EG')} ج.م</span></div>
            {owed > 0 && <div className="flex justify-between"><span className="text-gray-500">المستحق للمورد (آجل)</span><span className="font-bold tabular-nums text-red-600">{owed.toLocaleString('ar-EG')} ج.م</span></div>}
          </div>
        )}
      </div>

      {/* إرفاق فاتورة المورد */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">إرفاق صورة فاتورة المورد</label>
        <div className="flex items-center gap-3">
          {invoiceImage && <img src={invoiceImage} alt="فاتورة" className="w-14 h-14 object-cover rounded-lg border" />}
          <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} className="text-xs" />
          {invoiceImage && <button type="button" onClick={() => setInvoiceImage('')} className="text-xs text-red-500">إزالة</button>}
        </div>
      </div>

      <input placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="flex-1 bg-[#e94560] text-white py-2 rounded-lg font-semibold hover:bg-[#c73e54] disabled:opacity-50">{loading ? 'جاري...' : 'حفظ أمر الشراء'}</button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">إلغاء</button>
      </div>
    </form>
  )
}
