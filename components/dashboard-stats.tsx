'use client'

import {
  Banknote,
  ReceiptText,
  Factory,
  ShoppingBag,
  AlertTriangle,
  Truck,
  HandCoins,
  Scale,
} from 'lucide-react'

export interface KpiData {
  periodSales: number
  invoiceCount: number
  producedQty: number
  purchasesAmount: number
  lowStock: number
  activeDelegates: number
  cashAmount: number
  creditAmount: number
}

const fmt = (n: number) =>
  n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function DashboardStats({ data }: { data: KpiData }) {
  const cards = [
    { label: 'مبيعات الفترة', value: `${fmt(data.periodSales)} ج.م`, Icon: Banknote, color: 'bg-green-50 text-green-600' },
    { label: 'عدد الفواتير', value: fmt(data.invoiceCount), Icon: ReceiptText, color: 'bg-blue-50 text-blue-600' },
    { label: 'إنتاج الفترة', value: `${fmt(data.producedQty)} وحدة`, Icon: Factory, color: 'bg-purple-50 text-purple-600' },
    { label: 'مشتريات الفترة', value: `${fmt(data.purchasesAmount)} ج.م`, Icon: ShoppingBag, color: 'bg-orange-50 text-orange-600' },
    { label: 'محصّل نقدي', value: `${fmt(data.cashAmount)} ج.م`, Icon: HandCoins, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'آجل (مديونية)', value: `${fmt(data.creditAmount)} ج.م`, Icon: Scale, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'مندوبين نشطين', value: fmt(data.activeDelegates), Icon: Truck, color: 'bg-sky-50 text-sky-600' },
    { label: 'أصناف تحت الحد', value: fmt(data.lowStock), Icon: AlertTriangle, color: data.lowStock > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, Icon, color }) => (
        <div key={label} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#1a1a2e] tabular-nums truncate">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
