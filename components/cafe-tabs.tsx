'use client'

import { useState, type ReactNode } from 'react'
import { Cookie, Wallet, Receipt } from 'lucide-react'

// تبويبات إدارة الكافيه: المنتجات والتوليفات · الخزنة والتسوية · الطلبات والفواتير
export function CafeTabs({ products, treasury, orders }: { products: ReactNode; treasury: ReactNode; orders: ReactNode }) {
  const [tab, setTab] = useState<'products' | 'treasury' | 'orders'>('products')
  const TABS = [
    { key: 'products' as const, label: 'المنتجات والتوليفات', Icon: Cookie },
    { key: 'treasury' as const, label: 'الخزنة والتسوية', Icon: Wallet },
    { key: 'orders' as const, label: 'الطلبات والفواتير', Icon: Receipt },
  ]
  return (
    <div className="space-y-5">
      <div className="flex gap-2 bg-white rounded-2xl shadow-sm p-1.5 border border-gray-100 overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              tab === key ? 'bg-[#e94560] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      <div>
        {tab === 'products' && products}
        {tab === 'treasury' && treasury}
        {tab === 'orders' && orders}
      </div>
    </div>
  )
}
