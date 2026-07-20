'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { AlBadrLogo } from '@/components/albadr-logo'

// غلاف الداشبورد المتجاوب: سايدبار ثابت على الشاشات الكبيرة، درج منزلق على الموبايل
export function DashboardShell({ user, children }: { user: any; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* توب بار الموبايل */}
      <header className="lg:hidden no-print sticky top-0 z-40 bg-[#1a1a2e] text-white h-14 flex items-center justify-between px-4 shadow-md">
        <button onClick={() => setOpen(true)} className="p-2 -mr-2 rounded-lg hover:bg-white/10" aria-label="فتح القائمة">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm truncate">شركة البدر</span>
          <AlBadrLogo className="w-8 h-8 shrink-0 text-white" />
        </div>
      </header>

      {/* خلفية معتمة عند فتح الدرج */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40 no-print" onClick={() => setOpen(false)} aria-hidden />
      )}

      <Sidebar user={user} open={open} onClose={() => setOpen(false)} />

      <main className="lg:mr-64 min-w-0">{children}</main>
    </div>
  )
}
