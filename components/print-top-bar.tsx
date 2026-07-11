'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Printer } from 'lucide-react'

export function PrintTopBar() {
  const router = useRouter()
  return (
    <div className="no-print bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-10">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-5 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2545]"
      >
        <Printer className="w-4 h-4" />
        طباعة / حفظ PDF
      </button>
    </div>
  )
}
