'use client'

import Link from 'next/link'
import {
  Banknote,
  ReceiptText,
  Factory,
  ShoppingBag,
  AlertTriangle,
  Truck,
  HandCoins,
  Scale,
  ChevronLeft,
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

// كروت مؤشرات قابلة للضغط — كل كارت بيوصّلك لقسمه
export function DashboardStats({ data }: { data: KpiData }) {
  const cards = [
    { label: 'مبيعات الفترة', value: `${fmt(data.periodSales)} ج.م`, Icon: Banknote, color: 'bg-green-50 text-green-600', ring: 'hover:ring-green-200', href: '/sales' },
    { label: 'عدد الفواتير', value: fmt(data.invoiceCount), Icon: ReceiptText, color: 'bg-blue-50 text-blue-600', ring: 'hover:ring-blue-200', href: '/sales' },
    { label: 'إنتاج الفترة', value: `${fmt(data.producedQty)} وحدة`, Icon: Factory, color: 'bg-purple-50 text-purple-600', ring: 'hover:ring-purple-200', href: '/factory' },
    { label: 'مشتريات الفترة', value: `${fmt(data.purchasesAmount)} ج.م`, Icon: ShoppingBag, color: 'bg-orange-50 text-orange-600', ring: 'hover:ring-orange-200', href: '/factory' },
    { label: 'محصّل نقدي', value: `${fmt(data.cashAmount)} ج.م`, Icon: HandCoins, color: 'bg-emerald-50 text-emerald-600', ring: 'hover:ring-emerald-200', href: '/finance' },
    { label: 'آجل (مديونية)', value: `${fmt(data.creditAmount)} ج.م`, Icon: Scale, color: 'bg-yellow-50 text-yellow-700', ring: 'hover:ring-yellow-200', href: '/customers' },
    { label: 'مندوبين نشطين', value: fmt(data.activeDelegates), Icon: Truck, color: 'bg-sky-50 text-sky-600', ring: 'hover:ring-sky-200', href: '/delegates' },
    { label: 'أصناف تحت الحد', value: fmt(data.lowStock), Icon: AlertTriangle, color: data.lowStock > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400', ring: 'hover:ring-red-200', href: '/warehouse' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, Icon, color, ring, href }) => (
        <Link
          key={label}
          href={href}
          className={`group bg-white p-4 rounded-2xl shadow-sm ring-1 ring-transparent transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${ring}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${color}`}>
              <Icon className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-[#1a1a2e] tabular-nums truncate">{value}</p>
              <p className="text-xs text-gray-500 flex items-center justify-between gap-1">
                {label}
                <ChevronLeft className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
