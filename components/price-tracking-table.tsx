'use client'

import { useState, Fragment } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const fmt = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 3 })

interface Entry { supplier: string; invoiceNo: string; supplierInvoiceNo: string | null; date: string; quantity: number; unitPrice: number }
interface ProductRow {
  productId: string; name: string; unit: string; costPrice: number
  min: number; max: number; last: number; avg: number; bestSupplier: string; invoiceCount: number
  entries: Entry[]
}

export function PriceTrackingTable({ products }: { products: ProductRow[] }) {
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const list = search.trim() ? products.filter((p) => p.name.includes(search.trim())) : products

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن صنف..." className="w-full pr-9 pl-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
              <th className="px-4 py-2.5 font-medium">الصنف</th>
              <th className="px-4 py-2.5 font-medium">أقل سعر</th>
              <th className="px-4 py-2.5 font-medium">أعلى سعر</th>
              <th className="px-4 py-2.5 font-medium">المتوسط المرجّح</th>
              <th className="px-4 py-2.5 font-medium">آخر سعر</th>
              <th className="px-4 py-2.5 font-medium">التكلفة الحالية</th>
              <th className="px-4 py-2.5 font-medium">أرخص مورد</th>
              <th className="px-4 py-2.5 font-medium">فواتير</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">لا يوجد مشتريات بعد</td></tr>}
            {list.map((p) => {
              const open = openId === p.productId
              return (
                <Fragment key={p.productId}>
                  <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 cursor-pointer" onClick={() => setOpenId(open ? null : p.productId)}>
                    <td className="px-4 py-3 font-semibold text-[#1a1a2e]">
                      <span className="flex items-center gap-1.5">{open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}{p.name}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-green-700">{money(p.min)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-red-600">{money(p.max)}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">{money(p.avg)}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">{money(p.last)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-[#0f3460]">{money(p.costPrice)}</td>
                    <td className="px-4 py-3 text-xs text-green-700">{p.bestSupplier}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-500">{p.invoiceCount}</td>
                  </tr>
                  {open && (
                    <tr className="bg-gray-50/40">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 text-right">
                                <th className="px-2 py-1.5 font-medium">التاريخ</th>
                                <th className="px-2 py-1.5 font-medium">المورد</th>
                                <th className="px-2 py-1.5 font-medium">رقم الفاتورة</th>
                                <th className="px-2 py-1.5 font-medium">فاتورة المورد</th>
                                <th className="px-2 py-1.5 font-medium">الكمية</th>
                                <th className="px-2 py-1.5 font-medium">سعر الوحدة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.entries.map((e, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                  <td className="px-2 py-1.5 tabular-nums text-gray-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString('ar-EG')}</td>
                                  <td className="px-2 py-1.5 text-gray-700">{e.supplier}</td>
                                  <td className="px-2 py-1.5 tabular-nums text-[#0f3460]">{e.invoiceNo}</td>
                                  <td className="px-2 py-1.5 tabular-nums text-gray-500">{e.supplierInvoiceNo || '—'}</td>
                                  <td className="px-2 py-1.5 tabular-nums">{fmt(e.quantity)} {p.unit}</td>
                                  <td className={`px-2 py-1.5 tabular-nums font-semibold ${e.unitPrice === p.min ? 'text-green-700' : e.unitPrice === p.max ? 'text-red-600' : 'text-gray-700'}`}>{money(e.unitPrice)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
