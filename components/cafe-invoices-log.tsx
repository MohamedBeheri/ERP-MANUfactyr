'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Receipt, Search, Pencil, Trash2, Printer, X, Plus } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const PAYMENT_METHODS = ['نقدي', 'فيزا', 'انستاباي', 'مختلط']

interface Item { productId: string; name: string; unit: string; quantity: number; unitPrice: number; isBonus: boolean }
interface Invoice {
  id: string; invoiceNo: string; customerName: string | null; creatorName: string | null
  type: string; paymentMethod: string; discount: number; totalAmount: number; netAmount: number; createdAt: string; items: Item[]
}
interface ProductOpt { id: string; name: string; unit: string; sellPrice: number }

export function CafeInvoicesLog({ isAdmin, cafeWarehouseId, products, invoices }: {
  isAdmin: boolean
  cafeWarehouseId: string
  products: ProductOpt[]
  invoices: Invoice[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<Invoice | null>(null)

  const list = useMemo(() => {
    const q = search.trim()
    if (!q) return invoices
    return invoices.filter((i) => i.invoiceNo.includes(q) || (i.customerName || '').includes(q) || i.items.some((it) => it.name.includes(q)))
  }, [invoices, search])

  const remove = async (inv: Invoice) => {
    if (!confirm(`متأكد من حذف فاتورة ${inv.invoiceNo}؟ هيترجع المخزون ويتعكس أثرها على الخزنة والعميل.`)) return
    const res = await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) return alert(data.error || 'فشل الحذف')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Receipt className="w-6 h-6 text-amber-700" /></div>
          <div>
            <h3 className="text-base font-bold text-[#1a1a2e]">سجل فواتير الكافيه ({invoices.length})</h3>
            <p className="text-xs text-gray-500 mt-0.5">كل اللي اتطلب على الكاشير{isAdmin ? ' — الحذف والتعديل للأدمن فقط' : ''}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="رقم فاتورة / عميل / صنف..." className="w-full pr-9 pl-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e94560]" />
        </div>
      </div>

      {list.length === 0 ? (
        <p className="p-6 text-center text-gray-400 text-sm">مفيش فواتير</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
                <th className="px-3 py-2.5 font-medium">الفاتورة</th>
                <th className="px-3 py-2.5 font-medium">العميل</th>
                <th className="px-3 py-2.5 font-medium">الأصناف</th>
                <th className="px-3 py-2.5 font-medium">الدفع</th>
                <th className="px-3 py-2.5 font-medium">الصافي</th>
                <th className="px-3 py-2.5 font-medium">التاريخ</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                  <td className="px-3 py-2.5 font-bold text-[#0f3460] tabular-nums whitespace-nowrap">{inv.invoiceNo}<span className="block text-[10px] text-gray-400 font-normal">{inv.creatorName || '—'}</span></td>
                  <td className="px-3 py-2.5">{inv.customerName || 'عميل نقدي'}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs max-w-xs">{inv.items.map((it) => `${it.name}${it.isBonus ? ' (هدية)' : ''} ×${it.quantity}`).join('، ')}</td>
                  <td className="px-3 py-2.5"><span className="text-xs">{inv.type === 'CREDIT' ? 'آجل' : inv.paymentMethod}</span></td>
                  <td className="px-3 py-2.5 font-bold tabular-nums text-[#1a1a2e]">{money(inv.netAmount)} ج.م</td>
                  <td className="px-3 py-2.5 text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{new Date(inv.createdAt).toLocaleString('ar-EG')}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <a href={`/print/invoice-receipt/${inv.id}`} target="_blank" rel="noopener" className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg" title="طباعة"><Printer className="w-4 h-4" /></a>
                      {isAdmin && (
                        <>
                          <button onClick={() => setEdit(inv)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="تعديل"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => remove(inv)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="حذف"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && isAdmin && (
        <EditModal invoice={edit} products={products} cafeWarehouseId={cafeWarehouseId} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh() }} />
      )}
    </div>
  )
}

function EditModal({ invoice, products, cafeWarehouseId, onClose, onSaved }: {
  invoice: Invoice; products: ProductOpt[]; cafeWarehouseId: string; onClose: () => void; onSaved: () => void
}) {
  // بنعدّل البنود المدفوعة فقط (بنستبعد الهدايا — بتتحسب تلقائي)
  const [rows, setRows] = useState(invoice.items.filter((i) => !i.isBonus).map((i) => ({ productId: i.productId, name: i.name, unit: i.unit, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })))
  const [discount, setDiscount] = useState(String(invoice.discount || 0))
  const [method, setMethod] = useState(invoice.type === 'CREDIT' ? 'نقدي' : invoice.paymentMethod || 'نقدي')
  const [addId, setAddId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const total = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0)
  const net = total - (total * (Number(discount) || 0)) / 100

  const setRow = (i: number, k: 'quantity' | 'unitPrice', v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const addRow = () => {
    const p = products.find((x) => x.id === addId)
    if (!p || rows.some((r) => r.productId === p.id)) return
    setRows((prev) => [...prev, { productId: p.id, name: p.name, unit: p.unit, quantity: '1', unitPrice: String(p.sellPrice) }])
    setAddId('')
  }

  const save = async () => {
    const items = rows.map((r) => ({ productId: r.productId, quantity: Number(r.quantity) || 0, unitPrice: Number(r.unitPrice) || 0 })).filter((i) => i.quantity > 0)
    if (items.length === 0) return setError('لازم صنف واحد على الأقل')
    setBusy(true); setError('')
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, discount, paymentMethod: method, type: invoice.type, cafeSale: true, warehouseId: cafeWarehouseId }),
    })
    const data = await res.json(); setBusy(false)
    if (!res.ok) return setError(data.error || 'فشل التعديل')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-[#1a1a2e]">تعديل فاتورة {invoice.invoiceNo}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.productId} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-semibold text-[#1a1a2e]">{r.name} <span className="text-[10px] text-gray-400 font-normal">{r.unit}</span></span>
                <input type="text" inputMode="decimal" dir="ltr" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg tabular-nums text-sm" placeholder="كمية" />
                <input type="text" inputMode="decimal" dir="ltr" value={r.unitPrice} onChange={(e) => setRow(i, 'unitPrice', e.target.value)} className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg tabular-nums text-sm" placeholder="سعر" />
                <button onClick={() => removeRow(i)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">+ إضافة صنف...</option>
              {products.filter((p) => !rows.some((r) => r.productId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={addRow} disabled={!addId} className="p-2 bg-[#0f3460] text-white rounded-lg disabled:opacity-40"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-500">الخصم %</label>
              <input type="text" inputMode="decimal" dir="ltr" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums" />
            </div>
            {invoice.type !== 'CREDIT' && (
              <div>
                <label className="text-[11px] text-gray-500">طريقة الدفع</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <span className="text-sm text-gray-500">الصافي بعد التعديل</span>
            <span className="text-lg font-bold text-[#0f3460] tabular-nums">{money(net)} ج.م</span>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={save} disabled={busy} className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50">{busy ? 'جاري الحفظ...' : 'حفظ التعديل'}</button>
          <button onClick={onClose} className="px-5 py-2.5 text-gray-500 text-sm">إلغاء</button>
        </div>
      </div>
    </div>
  )
}
