'use client'

import { useState } from 'react'
import { Warehouse as WarehouseIcon } from 'lucide-react'

interface WarehouseLite {
  id: string
  name: string
  isDefault: boolean
}
interface ProductLite {
  id: string
  name: string
  unit: string
  minStock: number
  costPrice: number
  stocks: { warehouseId: string; quantity: number }[]
}

const money = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function WarehouseTabs({ warehouses, products }: { warehouses: WarehouseLite[]; products: ProductLite[] }) {
  const [active, setActive] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '')

  const rows = products
    .map((p) => {
      const qty = p.stocks.find((s) => s.warehouseId === active)?.quantity ?? 0
      return { ...p, qty }
    })
    .filter((p) => p.qty !== 0)

  const totalValue = rows.reduce((s, p) => s + p.qty * p.costPrice, 0)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
        <WarehouseIcon className="w-5 h-5 text-[#0f3460] shrink-0" />
        {warehouses.map((w) => (
          <button
            key={w.id}
            onClick={() => setActive(w.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              active === w.id ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {w.name}
          </button>
        ))}
        <span className="mr-auto text-sm text-gray-500">
          قيمة المخزن: <span className="font-bold text-[#1a1a2e] tabular-nums">{money(totalValue)} ج.م</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50">
              <th className="p-3 font-medium">الصنف</th>
              <th className="p-3 font-medium">الكمية</th>
              <th className="p-3 font-medium">الحد الأدنى</th>
              <th className="p-3 font-medium">تكلفة الوحدة</th>
              <th className="p-3 font-medium">قيمة الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 font-semibold">{p.name}</td>
                <td className="p-3">
                  <span className={`font-bold tabular-nums ${p.qty <= p.minStock ? 'text-red-600' : 'text-[#1a1a2e]'}`}>
                    {p.qty} {p.unit}
                  </span>
                  {p.qty <= p.minStock && (
                    <span className="mr-2 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">تحت الحد</span>
                  )}
                </td>
                <td className="p-3 text-gray-500 tabular-nums">{p.minStock}</td>
                <td className="p-3 text-gray-500 tabular-nums">{money(p.costPrice)}</td>
                <td className="p-3 font-semibold tabular-nums">{money(p.qty * p.costPrice)} ج.م</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">المخزن ده فاضي دلوقتي.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
