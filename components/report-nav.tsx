'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, ShoppingCart, TrendingUp, Package, Tags, Truck, RotateCcw,
  BookOpen, Landmark, CreditCard, Receipt, Clock, FileSpreadsheet,
  Users, Building2, Factory as FactoryIcon, ArrowDownUp, Scale, Boxes,
  ArrowLeftRight, Warehouse,
} from 'lucide-react'

const GROUPS: { title: string; items: { href: string; label: string; icon: React.ElementType }[] }[] = [
  {
    title: 'التقرير الشامل',
    items: [{ href: '/finance', label: 'الأرباح والخسائر الشاملة', icon: BarChart3 }],
  },
  {
    title: 'المبيعات',
    items: [
      { href: '/finance/sales', label: 'ملخص المبيعات', icon: TrendingUp },
      { href: '/finance/by-type', label: 'المبيعات حسب النوع', icon: ShoppingCart },
      { href: '/finance/items', label: 'الأصناف', icon: Package },
      { href: '/finance/categories', label: 'الفئات', icon: Tags },
      { href: '/finance/delegates', label: 'أداء المناديب', icon: Truck },
      { href: '/finance/returns', label: 'المرتجعات', icon: RotateCcw },
    ],
  },
  {
    title: 'المالية',
    items: [
      { href: '/finance/journal', label: 'اليومية المالية', icon: BookOpen },
      { href: '/finance/treasury', label: 'حركة الخزينة', icon: Landmark },
      { href: '/finance/cashflow', label: 'التدفقات النقدية', icon: ArrowDownUp },
      { href: '/finance/payments', label: 'طرق الدفع', icon: CreditCard },
      { href: '/finance/vouchers', label: 'السندات', icon: Receipt },
      { href: '/finance/expenses', label: 'المصروفات', icon: FileSpreadsheet },
      { href: '/finance/receivables', label: 'المستحقات والآجل', icon: Clock },
      { href: '/finance/liabilities', label: 'الالتزامات والأقساط', icon: Scale },
    ],
  },
  {
    title: 'التشغيل',
    items: [
      { href: '/finance/production', label: 'التصنيع والإنتاج', icon: FactoryIcon },
      { href: '/finance/purchases', label: 'المشتريات والموردين', icon: Boxes },
    ],
  },
  {
    title: 'المخازن',
    items: [
      { href: '/finance/stock-warehouses', label: 'الأصناف حسب المخزن', icon: Warehouse },
      { href: '/finance/stock-movement', label: 'حركة صنف', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'العملاء والموردين',
    items: [
      { href: '/finance/customers', label: 'كشف العملاء', icon: Users },
      { href: '/finance/key-accounts', label: 'كبار الموردين', icon: Building2 },
      { href: '/finance/suppliers', label: 'الموردون', icon: Truck },
    ],
  },
]

export function ReportNav() {
  const pathname = usePathname()

  return (
    <nav className="no-print shrink-0 lg:w-60 lg:border-l border-gray-100 bg-white lg:bg-transparent">
      {/* موبايل: شرائط أفقية */}
      <div className="lg:hidden overflow-x-auto flex gap-2 p-3 border-b border-gray-100 bg-white">
        {GROUPS.flatMap(g => g.items).map(it => {
          const active = pathname === it.href
          const Icon = it.icon
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                active ? 'bg-[#0f3460] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {it.label}
            </Link>
          )
        })}
      </div>

      {/* ديسكتوب: قائمة عمودية */}
      <div className="hidden lg:block p-4 sticky top-4 space-y-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {GROUPS.map(g => (
          <div key={g.title}>
            <p className="text-[11px] font-bold text-gray-400 mb-1.5 px-2">{g.title}</p>
            <div className="space-y-0.5">
              {g.items.map(it => {
                const active = pathname === it.href
                const Icon = it.icon
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      active ? 'bg-blue-50 text-[#0f3460] ring-1 ring-blue-100' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-[#0f3460]' : 'text-gray-400'}`} />
                    <span>{it.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
