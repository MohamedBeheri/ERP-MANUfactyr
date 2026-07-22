'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'

export function ReceiptConfirm({ orderId, className }: { orderId: string; className?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    if (!window.confirm('تأكيد استلام حمولة العربية؟ البضاعة هتخرج من المخزن وتتحرك على عهدتك.')) return
    setLoading(true)
    const res = await fetch(`/api/delivery-orders/${orderId}/confirm`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { alert(data.error || 'فشل التأكيد'); return }
    router.refresh()
  }

  return (
    <button
      onClick={confirm}
      disabled={loading}
      className={className || 'flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-5 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50'}
    >
      <ClipboardCheck className="w-5 h-5" />
      {loading ? 'جاري التأكيد...' : 'تأكيد استلام الحمولة (مطابقة)'}
    </button>
  )
}
