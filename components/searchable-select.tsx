'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

export interface SearchableOption {
  value: string
  label: string
  sublabel?: string
  disabled?: boolean
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

// سيلكت بحث سريع للقوائم الطويلة (أصناف/منتجات) — كتابة تفلتر فوريًا بدل التمرير في مئات الاختيارات
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'اختار...',
  emptyText = 'مفيش نتائج مطابقة',
  className = inputCls,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value) || null

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return options
    return options.filter((o) => o.label.includes(q) || (o.sublabel && o.sublabel.includes(q)))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEffect(() => {
    if (open) {
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const pick = (opt: SearchableOption) => {
    if (opt.disabled) return
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIndex]) pick(filtered[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={`${className} flex items-center justify-between gap-2 text-right disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className={selected ? 'text-[#1a1a2e] truncate' : 'text-gray-400 truncate'}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onChange('') }}
                className="text-gray-300 hover:text-red-500"
                aria-label="مسح الاختيار"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="دوّر بالاسم..."
            className={`${className} pr-9`}
          />
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {filtered.length === 0 && <p className="px-3 py-2.5 text-sm text-gray-400">{emptyText}</p>}
          {filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              onClick={() => pick(o)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full text-right px-3 py-2 text-sm flex flex-col disabled:opacity-40 disabled:cursor-not-allowed ${
                i === activeIndex ? 'bg-[#e94560]/10' : ''
              } ${o.value === value ? 'font-semibold text-[#e94560]' : 'text-[#1a1a2e]'}`}
            >
              <span className="leading-snug break-words">{o.label}</span>
              {o.sublabel && <span className="text-xs text-gray-400 leading-snug break-words">{o.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
