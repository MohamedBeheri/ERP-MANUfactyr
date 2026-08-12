'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { TimerOff } from 'lucide-react'

const IDLE_MS = 3 * 60 * 1000 // 3 دقايق خمول متواصل → خروج تلقائي
const WARN_MS = 30 * 1000 // تحذير قبل الخروج بـ30 ثانية

// خروج تلقائي بعد فترة خمول — حماية للجهاز المفتوح من غير صاحبه
// أي حركة (ماوس/كيبورد/لمس/سكرول) بتصفّر العداد، وقبل الخروج بنصف دقيقة بيظهر تحذير
export function IdleLogout() {
  const [warning, setWarning] = useState(false)
  const lastActivity = useRef(Date.now())
  const warningRef = useRef(false)

  useEffect(() => {
    const bump = () => {
      lastActivity.current = Date.now()
      if (warningRef.current) {
        warningRef.current = false
        setWarning(false)
      }
    }
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity.current
      if (idle >= IDLE_MS) {
        signOut({ callbackUrl: '/' })
      } else if (idle >= IDLE_MS - WARN_MS && !warningRef.current) {
        warningRef.current = true
        setWarning(true)
      }
    }, 5000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(interval)
    }
  }, [])

  if (!warning) return null
  return (
    <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-[#1a1a2e] text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 text-sm">
      <TimerOff className="w-5 h-5 text-amber-400 shrink-0" />
      <span>مفيش نشاط من فترة — هيتم تسجيل الخروج تلقائيًا خلال ثواني. حرّك الماوس للاستمرار.</span>
    </div>
  )
}
