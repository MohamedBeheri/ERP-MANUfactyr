'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DelegateForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [carNumber, setCarNumber] = useState('')
  const [area, setArea] = useState('')
  const [commissionRate, setCommissionRate] = useState('5')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name) {
      setError('اسم المندوب مطلوب')
      return
    }

    setLoading(true)
    const res = await fetch('/api/delegates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, carNumber, area, commissionRate: Number(commissionRate) }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'حصل خطأ')
      return
    }

    setName('')
    setPhone('')
    setCarNumber('')
    setArea('')
    setCommissionRate('5')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-white p-4 rounded-xl shadow-sm text-sm font-semibold text-[#0f3460] hover:bg-gray-50"
      >
        + إضافة مندوب جديد
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-3">
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="اسم المندوب"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        />
        <input
          placeholder="التليفون"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        />
        <input
          placeholder="رقم العربية"
          value={carNumber}
          onChange={(e) => setCarNumber(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        />
        <input
          placeholder="المنطقة"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        />
        <input
          type="number"
          placeholder="نسبة العمولة %"
          value={commissionRate}
          onChange={(e) => setCommissionRate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-[#0f3460] text-white py-2 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50"
        >
          {loading ? 'جاري الحفظ...' : 'حفظ'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          إلغاء
        </button>
      </div>
    </form>
  )
}
