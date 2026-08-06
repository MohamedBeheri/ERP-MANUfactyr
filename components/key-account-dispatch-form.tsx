'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Plus, X, Printer, CheckCircle2, ChevronDown, ChevronUp, Warehouse as WarehouseIcon } from 'lucide-react'
import { SearchableSelect } from '@/components/searchable-select'

interface ProductLite {
  id: string
  name: string
  unit: string
  minKeyPrice: number
  stocks: { warehouseId: string; quantity: number }[]
}
interface AccountLite {
  id: string
  name: string
  branches: { id: string; name: string }[]
  quoteItems: { productId: string; unitPrice: number }[]
}
interface WarehouseLite { id: string; name: string; isDefault: boolean }

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

// طلبية إرسال مستقلة: توريد بالكمية لفرع أو عدة فروع — البضاعة بتتخصم من المخزن مباشرة
export function KeyAccountDispatchForm({
  accounts,
  products,
  warehouses,
}: {
  accounts: AccountLite[]
  products: ProductLite[]
  warehouses: WarehouseLite[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [keyAccountId, setKeyAccountId] = useState('')
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '')
  const [discountType, setDiscountType] = useState<'NONE' | 'CASH'>('NONE')
  const [discountPercent, setDiscountPercent] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([{ branchId: '', productId: '', quantity: '', unitPrice: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ id: string; supplyNo: string; branch: string }[] | null>(null)

  const account = accounts.find((a) => a.id === keyAccountId)
  const quoteMap = new Map((account?.quoteItems || []).map((q) => [q.productId, q.unitPrice]))
  const productMap = new Map(products.map((p) => [p.id, p]))

  const stockOf = (productId: string) =>
    productMap.get(productId)?.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0

  const priceFor = (productId: string) => {
    const q = quoteMap.get(productId)
    if (q && q > 0) return String(q)
    const floor = productMap.get(productId)?.minKeyPrice || 0
    return floor > 0 ? String(floor) : ''
  }

  const setRow = (i: number, f: string, v: string) => {
    setRows(rows.map((r, j) => {
      if (j !== i) return r
      if (f === 'productId') return { ...r, productId: v, unitPrice: priceFor(v) }
      return { ...r, [f]: v }
    }))
  }

  const total = rows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0), 0)
  const dPct = discountType === 'CASH' ? parseFloat(discountPercent) || 0 : 0
  const net = total - (total * dPct) / 100
  const branchCount = new Set(rows.filter((r) => r.branchId).map((r) => r.branchId)).size

  async function submit() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/key-accounts/supply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyAccountId,
        warehouseId,
        discountType,
        discountPercent,
        notes,
        lines: rows,
      }),
    })
    setLoading(false)
    if (!res.ok) return setError((await res.json()).error || 'فشل تسجيل الطلبية')
    const data = await res.json()
    setDone(data.supplies.map((s: any) => ({ id: s.id, supplyNo: s.supplyNo, branch: s.branch.name })))
    router.refresh()
  }

  function reset() {
    setDone(null)
    setKeyAccountId('')
    setRows([{ branchId: '', productId: '', quantity: '', unitPrice: '' }])
    setDiscountType('NONE')
    setDiscountPercent('')
    setNotes('')
    setOpen(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-right">
        <span className="flex items-center gap-2 text-base font-bold text-[#1a1a2e]">
          <Send className="w-5 h-5 text-[#e94560]" /> طلبية إرسال جديدة (فرع أو عدة فروع)
        </span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {done ? (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <p className="font-bold text-green-700">تم تسجيل الطلبية وخصم البضاعة من المخزن — {done.length} توريد</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {done.map((s) => (
                  <a key={s.id} href={`/print/supply/${s.id}`} target="_blank" className="inline-flex items-center gap-1.5 bg-[#0f3460] text-white px-4 py-2 rounded-lg text-sm font-bold">
                    <Printer className="w-4 h-4" /> {s.supplyNo} — {s.branch}
                  </a>
                ))}
              </div>
              <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 underline">طلبية جديدة</button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SearchableSelect
                  value={keyAccountId}
                  onChange={(v) => { setKeyAccountId(v); setRows([{ branchId: '', productId: '', quantity: '', unitPrice: '' }]) }}
                  placeholder="اختار العميل (المقر الرئيسي) *"
                  className={inputCls}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                />
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <select className={inputCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>

              {account && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500">سطور التوريد — كل سطر: فرع + صنف + كمية (ممكن تكرر نفس الفرع أو توزّع على فروع مختلفة)</p>
                    {rows.map((r, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_90px_100px_32px] gap-2 items-center">
                        <select className={inputCls} value={r.branchId} onChange={(e) => setRow(i, 'branchId', e.target.value)}>
                          <option value="">الفرع *</option>
                          {account.branches.map((br) => <option key={br.id} value={br.id}>{br.name}</option>)}
                        </select>
                        <SearchableSelect
                          value={r.productId}
                          onChange={(v) => setRow(i, 'productId', v)}
                          placeholder="الصنف *"
                          className={inputCls}
                          options={products.map((p) => ({ value: p.id, label: p.name, sublabel: `متاح ${fmt(stockOf(p.id))}` }))}
                        />
                        <input className={inputCls} type="text" inputMode="decimal" dir="ltr" placeholder="الكمية" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} />
                        <input className={inputCls} type="text" inputMode="decimal" dir="ltr" placeholder="السعر" value={r.unitPrice} onChange={(e) => setRow(i, 'unitPrice', e.target.value)} />
                        <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700" disabled={rows.length === 1}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setRows([...rows, { branchId: rows[rows.length - 1]?.branchId || '', productId: '', quantity: '', unitPrice: '' }])} className="text-xs font-semibold text-[#0f3460] flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> إضافة سطر
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select className={inputCls} value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}>
                      <option value="NONE">بدون خصم</option>
                      <option value="CASH">خصم نقدي %</option>
                    </select>
                    {discountType === 'CASH' && (
                      <input className={inputCls} type="text" inputMode="decimal" dir="ltr" placeholder="نسبة الخصم %" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
                    )}
                    <input className={inputCls} placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-sm text-gray-600">
                      {branchCount > 0 && <span className="font-semibold">{branchCount} فرع · </span>}
                      الإجمالي: <span className="font-bold tabular-nums">{fmt(total)} ج.م</span>
                      {dPct > 0 && <> — الصافي بعد الخصم: <span className="font-bold tabular-nums text-green-700">{fmt(net)} ج.م</span></>}
                    </p>
                    <button onClick={submit} disabled={loading || !keyAccountId || total <= 0} className="bg-[#e94560] text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40">
                      {loading ? 'جارٍ التسجيل...' : 'تنفيذ الطلبية وخصم المخزن'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
