'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'
import { useNotifications, setNotifSound, refreshNotifications } from '@/hooks/use-notifications'

// نغمة تنبيه قصيرة عبر Web Audio (من غير ملف صوت خارجي)
function playBeep() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.setValueAtTime(1180, ctx.currentTime + 0.12)
    g.gain.setValueAtTime(0.001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    o.start(); o.stop(ctx.currentTime + 0.36)
  } catch { /* المتصفح منع الصوت — تجاهل */ }
}

export function NotificationsBell() {
  const { total, groups, loading } = useNotifications()
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // الجرس هو اللي بيشغّل الصوت + وميض عند وصول بند جديد
  useEffect(() => {
    setNotifSound(() => { playBeep(); setFlash(true); setTimeout(() => setFlash(false), 2500) })
    return () => setNotifSound(null)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) refreshNotifications() }}
        className={`relative p-2 rounded-lg hover:bg-white/10 text-white transition-colors ${flash ? 'animate-pulse' : ''}`}
        aria-label="الإشعارات"
      >
        <Bell className={`w-5 h-5 ${total > 0 ? 'text-amber-300' : 'text-gray-300'}`} />
        {total > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#e94560] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 max-w-[92vw] bg-white rounded-xl shadow-2xl border border-gray-100 z-[70] overflow-hidden text-right">
          <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a2e] text-white">
            <span className="text-sm font-bold">الإشعارات {total > 0 ? `(${total})` : ''}</span>
            <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading && <p className="p-5 text-center text-sm text-gray-400">جاري التحميل...</p>}
            {!loading && groups.length === 0 && <p className="p-6 text-center text-sm text-gray-500">مفيش حاجة محتاجة أكشن دلوقتي ✓</p>}
            {groups.map((g, i) => (
              <Link
                key={i}
                href={g.href as any}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className={`min-w-[26px] h-[26px] px-1.5 rounded-lg text-xs font-bold flex items-center justify-center tabular-nums shrink-0 ${g.tone === 'warn' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                  {g.count}
                </span>
                <span className="text-sm text-gray-700 flex-1">{g.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
