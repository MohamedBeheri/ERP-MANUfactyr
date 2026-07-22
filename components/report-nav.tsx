'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// قائمة التقارير الجانبية — مجمّعة زي التقرير الشامل بتاع الكافيه
const GROUPS: { title: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    title: 'التقرير الشامل',
    items: [{ href: '/finance', label: 'الأرباح والخسائر الشاملة', icon: '🎰' }],
  },
  {
    title: 'المبيعات',
    items: [
      { href: '/finance/sales', label: 'ملخص المبيعات', icon: '📊' },
      { href: '/finance/by-type', label: 'المبيعات حسب النوع', icon: '🧭' },
      { href: '/finance/items', label: 'الأصناف', icon: '📦' },
      { href: '/finance/categories', label: 'الفئات', icon: '🏷️' },
      { href: '/finance/delegates', label: 'أداء المناديب', icon: '🚚' },
      { href: '/finance/returns', label: 'المرتجعات', icon: '↩️' },
    ],
  },
  {
    title: 'المالية',
    items: [
      { href: '/finance/journal', label: 'اليومية المالية', icon: '📒' },
      { href: '/finance/treasury', label: 'حركة الخزينة', icon: '🏛️' },
      { href: '/finance/payments', label: 'طرق الدفع', icon: '💳' },
      { href: '/finance/vouchers', label: 'السندات', icon: '🧾' },
      { href: '/finance/receivables', label: 'المستحقات والآجل', icon: '⏳' },
      { href: '/finance/expenses', label: 'المصروفات', icon: '🧹' },
    ],
  },
  {
    title: 'العملاء والموردين',
    items: [
      { href: '/finance/customers', label: 'كشف العملاء', icon: '👥' },
      { href: '/finance/key-accounts', label: 'كبار الموردين', icon: '🏢' },
      { href: '/finance/suppliers', label: 'الموردون', icon: '🚛' },
    ],
  },
]

export function ReportNav() {
  const pathname = usePathname()

  return (
    <nav className="no-print shrink-0 lg:w-60 lg:border-l border-gray-100 bg-white lg:bg-transparent">
      {/* موبايل: شرائط أفقية قابلة للتمرير */}
      <div className="lg:hidden overflow-x-auto flex gap-2 p-3 border-b border-gray-100 bg-white">
        {GROUPS.flatMap((g) => g.items).map((it) => {
          const active = pathname === it.href
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold ${
                active ? 'bg-[#0f3460] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span className="ml-1">{it.icon}</span>
              {it.label}
            </Link>
          )
        })}
      </div>

      {/* ديسكتوب: قائمة عمودية مجمّعة */}
      <div className="hidden lg:block p-4 sticky top-4 space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="text-[11px] font-bold text-gray-400 mb-1.5 px-2">{g.title}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = pathname === it.href
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      active ? 'bg-blue-50 text-[#0f3460] ring-1 ring-blue-100' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{it.icon}</span>
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
