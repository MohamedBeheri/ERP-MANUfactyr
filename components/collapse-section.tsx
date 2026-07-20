'use client'

import { useState, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// قسم قابل للطي والفتح — لتنظيم لوحة موقع العميل
export function CollapseSection({
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  badge?: string | number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-5 text-right hover:bg-gray-50/60 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="min-w-0">
            <p className="font-bold text-[#1a1a2e] flex items-center gap-2">
              {title}
              {badge !== undefined && badge !== 0 && (
                <span className="text-xs bg-[#e94560] text-white px-2 py-0.5 rounded-full font-bold tabular-nums">{badge}</span>
              )}
            </p>
            {subtitle && <p className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-5 pt-0 border-t border-gray-50">{children}</div>
        </div>
      </div>
    </div>
  )
}
