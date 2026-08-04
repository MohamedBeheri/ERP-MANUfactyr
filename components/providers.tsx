'use client'

import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import { SplashScreen } from './splash-screen'
import { normalizeDigits } from '@/lib/numbers'

// مطبّع عام: أي أرقام عربية تتكتب في أي input بتتحول إنجليزي لحظيًا
// عشان كل الحسابات والتقارير تتوحد مهما كانت لغة الكيبورد
function DigitNormalizer() {
  useEffect(() => {
    const handler = (e: Event) => {
      const el = e.target as HTMLInputElement
      if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return
      const type = (el as HTMLInputElement).type
      if (type === 'password' || type === 'file' || type === 'checkbox' || type === 'radio') return
      const val = el.value
      if (!val || !/[٠-٩۰-۹٫]/.test(val)) return
      const normalized = normalizeDigits(val)
      if (normalized === val) return
      const pos = el.selectionStart
      const setter = Object.getOwnPropertyDescriptor(
        el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,
        'value'
      )?.set
      setter?.call(el, normalized)
      if (pos !== null && pos !== undefined) {
        try { el.setSelectionRange(pos, pos) } catch { /* أنواع لا تدعم التحديد */ }
      }
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    document.addEventListener('input', handler, true)
    return () => document.removeEventListener('input', handler, true)
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DigitNormalizer />
      <SplashScreen />
      {children}
    </SessionProvider>
  )
}
