'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  LayoutDashboard,
  Factory,
  Warehouse,
  ShoppingCart,
  Truck,
  Car,
  Wallet,
  ShieldCheck,
  Settings,
  LogOut,
} from 'lucide-react'
import { effectivePermissions } from '@/lib/permissions'

const menuItems = [
  { href: '/dashboard', label: 'لوحة التحكم', Icon: LayoutDashboard, perm: null },
  { href: '/factory', label: 'المصنع', Icon: Factory, perm: 'factory' },
  { href: '/warehouse', label: 'المخزن', Icon: Warehouse, perm: 'warehouse' },
  { href: '/sales', label: 'المبيعات', Icon: ShoppingCart, perm: 'sales' },
  { href: '/delegates', label: 'المندوبين', Icon: Truck, perm: 'delegates' },
  { href: '/drivers', label: 'السائقين', Icon: Car, perm: 'drivers' },
  { href: '/finance', label: 'التقارير', Icon: Wallet, perm: 'finance' },
  { href: '/governance', label: 'الحوكمة', Icon: ShieldCheck, perm: 'governance' },
  { href: '/settings', label: 'الإعدادات', Icon: Settings, perm: 'settings' },
]

export function Sidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const allowed = effectivePermissions(user?.role, user?.permissions)
  const filteredMenu = menuItems.filter((item) => !item.perm || allowed.includes(item.perm))

  return (
    <aside className="no-print fixed right-0 top-0 bottom-0 w-64 bg-[#1a1a2e] text-white overflow-y-auto z-50">
      <div className="p-5 border-b border-white/10 flex items-center gap-3">
        <Image src="/logo.png" alt="شعار شركة البدر" width={44} height={67} className="shrink-0" />
        <div>
          <h2 className="text-base font-bold text-white leading-tight">شركة البدر</h2>
          <p className="text-[11px] text-gray-400">لتجارة البن — نظام الإدارة</p>
        </div>
      </div>
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#e94560] flex items-center justify-center font-bold text-sm">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-400">{user?.role || 'User'}</p>
          </div>
        </div>
      </div>
      <nav className="p-3 space-y-1">
        {filteredMenu.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                active
                  ? 'bg-[#e94560]/10 text-[#e94560]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="font-medium text-sm">{label}</span>
              {active && <span className="mr-auto w-1.5 h-1.5 rounded-full bg-[#e94560]" />}
            </Link>
          )
        })}
        <div className="pt-6 mt-4 border-t border-white/10">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" strokeWidth={1.8} />
            <span className="font-medium text-sm">تسجيل الخروج</span>
          </button>
        </div>
      </nav>
    </aside>
  )
}
