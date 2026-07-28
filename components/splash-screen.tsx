'use client'

import { useState, useEffect } from 'react'
import { Phone, Globe, X } from 'lucide-react'

export function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    const shown = sessionStorage.getItem('splash-shown')
    if (shown) { setVisible(false); return }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          dismiss()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  function dismiss() {
    setFadeOut(true)
    sessionStorage.setItem('splash-shown', '1')
    setTimeout(() => setVisible(false), 500)
  }

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      onClick={dismiss}
    >
      <div
        className={`relative mx-4 w-full max-w-lg rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl border border-amber-500/30 text-center transition-all duration-500 ${fadeOut ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 left-3 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Countdown */}
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full border-2 border-amber-500/50 flex items-center justify-center">
          <span className="text-xs text-amber-400 font-bold">{countdown}</span>
        </div>

        {/* Decorative top line */}
        <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400" />

        {/* Welcome text */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          أهلاً بكم في شركة
        </h2>
        <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-1">
          كفو
        </h1>
        <p className="text-lg text-amber-200/80 mb-6">لتطوير البرمجيات والتسويق</p>

        {/* Website */}
        <a
          href="https://kaffo.co"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-xl font-bold mb-8 transition-colors"
        >
          <Globe size={20} />
          Kaffo.co
        </a>

        {/* Divider */}
        <div className="border-t border-slate-700 my-6" />

        {/* Phone numbers */}
        <div className="space-y-4">
          {/* Egypt */}
          <div>
            <p className="text-sm text-slate-400 mb-2 flex items-center justify-center gap-1">
              <span className="text-lg">🇪🇬</span> لطلب المنتج من داخل مصر
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <a href="tel:01121214614" className="inline-flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-4 py-2 rounded-lg text-lg font-mono tracking-wider transition-colors" dir="ltr">
                <Phone size={16} />
                01121214614
              </a>
              <a href="tel:01147617485" className="inline-flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-4 py-2 rounded-lg text-lg font-mono tracking-wider transition-colors" dir="ltr">
                <Phone size={16} />
                01147617485
              </a>
            </div>
          </div>

          {/* Saudi */}
          <div>
            <p className="text-sm text-slate-400 mb-2 flex items-center justify-center gap-1">
              <span className="text-lg">🇸🇦</span> للطلب من داخل السعودية
            </p>
            <a href="tel:+966500026103" className="inline-flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-4 py-2 rounded-lg text-lg font-mono tracking-wider transition-colors" dir="ltr">
              <Phone size={16} />
              +966 50 002 6103
            </a>
          </div>
        </div>

        {/* Skip text */}
        <p className="mt-6 text-xs text-slate-500">اضغط في أي مكان للتخطي</p>
      </div>
    </div>
  )
}
