'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { AlBadrLogo } from '@/components/albadr-logo'
import {
  LayoutDashboard,
  Factory,
  Coffee,
  Warehouse,
  ArrowLeftRight,
  ShoppingCart,
  ShoppingBag,
  Truck,
  Car,
  Vault,
  Wallet,
  Store,
  PackageOpen,
  Cookie,
  Users,
  UserCog,
  HandCoins,
  Building2,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronDown,
  X,
} from 'lucide-react'
import { effectivePermissions } from '@/lib/permissions'

type Item = { href: string; label: string; Icon: any; perm: string | null }
// standalone = بند مفرد بدون مجموعة (زي لوحة التحكم)
// group = مجموعة قابلة للطي (accordion) ليها أيقونة وعنوان وبنود فرعية
type Entry =
  | { kind: 'standalone'; item: Item }
  | { kind: 'group'; id: string; title: string; Icon: any; items: Item[] }

const menu: Entry[] = [
  { kind: 'standalone', item: { href: '/dashboard', label: 'لوحة التحكم', Icon: LayoutDashboard, perm: null } },
  { kind: 'standalone', item: { href: '/my-custody', label: 'عُهدتي', Icon: HandCoins, perm: null } },
  {
    kind: 'group', id: 'factory', title: 'التصنيع والمخازن', Icon: Factory,
    items: [
      { href: '/factory', label: 'المصنع', Icon: Factory, perm: 'factory' },
      { href: '/catalog', label: 'بنك الأصناف', Icon: Coffee, perm: 'catalog' },
      { href: '/purchases', label: 'المشتريات', Icon: ShoppingBag, perm: 'purchases' },
      { href: '/warehouse', label: 'المخزن', Icon: Warehouse, perm: 'warehouse' },
      { href: '/warehouse/transfers', label: 'تحويلات المخازن', Icon: ArrowLeftRight, perm: 'warehouse' },
    ],
  },
  {
    kind: 'group', id: 'sales', title: 'البيع والتوزيع', Icon: ShoppingCart,
    items: [
      { href: '/sales', label: 'المبيعات', Icon: ShoppingCart, perm: 'sales' },
      { href: '/customers', label: 'العملاء', Icon: Users, perm: 'customers' },
      { href: '/key-accounts', label: 'كبار الموردين', Icon: Building2, perm: 'keyaccounts' },
      { href: '/delegates', label: 'إدارة المناديب', Icon: Truck, perm: 'delegates' },
      { href: '/drivers', label: 'المناديب', Icon: Car, perm: 'drivers' },
    ],
  },
  {
    kind: 'group', id: 'cafe', title: 'إدارة الكافيه', Icon: Cookie,
    items: [
      { href: '/cafe', label: 'الكافيه (نقطة البيع والمخزون)', Icon: Cookie, perm: 'cafe' },
    ],
  },
  {
    kind: 'group', id: 'store', title: 'الموقع الإلكتروني', Icon: Store,
    items: [
      { href: '/store-settings', label: 'موقع العميل', Icon: Store, perm: 'store' },
      { href: '/online-orders', label: 'طلبات الموقع', Icon: PackageOpen, perm: 'store' },
    ],
  },
  {
    kind: 'group', id: 'admin', title: 'المالية والإدارة', Icon: Wallet,
    items: [
      { href: '/treasury', label: 'الخزنة والعُهد', Icon: Vault, perm: 'treasury' },
      { href: '/finance', label: 'التقارير', Icon: Wallet, perm: 'finance' },
      { href: '/employees', label: 'الموظفين', Icon: UserCog, perm: 'employees' },
      { href: '/governance', label: 'الحوكمة', Icon: ShieldCheck, perm: 'governance' },
      { href: '/settings', label: 'الإعدادات', Icon: Settings, perm: 'settings' },
    ],
  },
]

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/')

export function Sidebar({ user, open = false, onClose }: { user: any; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const allowed = effectivePermissions(user?.role, user?.permissions)
  const hasPerm = (perm: string | null) => !perm || allowed.includes(perm) || allowed.some((p) => p.startsWith(perm + ':'))

  // فلترة البنود حسب الصلاحيات + استبعاد المجموعات الفاضية
  const entries: Entry[] = menu
    .map((e) => {
      if (e.kind === 'standalone') return hasPerm(e.item.perm) ? e : null
      const items = e.items.filter((it) => hasPerm(it.perm))
      return items.length > 0 ? { ...e, items } : null
    })
    .filter(Boolean) as Entry[]

  // المجموعة اللي فيها الصفحة المفتوحة تكون مفتوحة تلقائيًا
  const activeGroup = entries.find(
    (e) => e.kind === 'group' && e.items.some((it) => isActive(pathname, it.href))
  ) as Extract<Entry, { kind: 'group' }> | undefined
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    activeGroup ? { [activeGroup.id]: true } : {}
  )
  const toggle = (id: string) => setOpenGroups((s) => ({ ...s, [id]: !s[id] }))

  return (
    <aside
      className={`no-print fixed right-0 top-0 bottom-0 w-64 bg-[#1a1a2e] text-white overflow-y-auto z-50 transition-transform duration-300 ease-out lg:translate-x-0 ${
        open ? 'translate-x-0 shadow-2xl' : 'translate-x-full'
      }`}
    >
      <div className="p-5 border-b border-white/10 flex items-center gap-3">
        <AlBadrLogo className="w-11 h-11 shrink-0 text-white" />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white leading-tight">شركة البدر</h2>
          <p className="text-[11px] text-gray-400">لتجارة البن — نظام الإدارة</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="mr-auto p-2 text-gray-400 hover:text-white lg:hidden" aria-label="إغلاق القائمة">
            <X className="w-5 h-5" />
          </button>
        )}
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
        {entries.map((e) => {
          if (e.kind === 'standalone') {
            const active = isActive(pathname, e.item.href)
            const Icon = e.item.Icon
            return (
              <Link
                key={e.item.href}
                href={e.item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  active ? 'bg-[#e94560]/10 text-[#e94560]' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                <span className="font-medium text-sm">{e.item.label}</span>
                {active && <span className="mr-auto w-1.5 h-1.5 rounded-full bg-[#e94560]" />}
              </Link>
            )
          }

          const GroupIcon = e.Icon
          const groupActive = e.items.some((it) => isActive(pathname, it.href))
          const isOpen = openGroups[e.id] ?? groupActive
          return (
            <div key={e.id}>
              <button
                onClick={() => toggle(e.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  groupActive ? 'text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <GroupIcon className="w-5 h-5 shrink-0" strokeWidth={groupActive ? 2.2 : 1.8} />
                <span className="font-semibold text-sm">{e.title}</span>
                <ChevronDown className={`mr-auto w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="mt-1 mr-4 pr-3 border-r border-white/10 space-y-0.5">
                  {e.items.map(({ href, label, Icon }) => {
                    const active = isActive(pathname, href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                          active ? 'bg-[#e94560]/10 text-[#e94560]' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                        <span className="font-medium text-[13px]">{label}</span>
                        {active && <span className="mr-auto w-1.5 h-1.5 rounded-full bg-[#e94560]" />}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
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
      <div className="p-4 border-t border-white/10 text-center">
        <p className="text-[10px] text-gray-500">
          تصميم وتطوير بواسطة{' '}
          <a href="https://kaffo.co" target="_blank" rel="noopener noreferrer" className="text-amber-500/70 hover:text-amber-400 transition-colors font-bold">
            شركة كفو Kaffo.co
          </a>
        </p>
      </div>
    </aside>
  )
}
