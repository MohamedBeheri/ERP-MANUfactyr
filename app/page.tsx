'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('ADMIN')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      username,
      password,
      role,
      redirect: false,
    })

    if (result?.error) {
      setError('بيانات الدخول غير صحيحة')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
      <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center text-5xl mb-4">☕</div>
        <h1 className="text-2xl font-bold text-center text-[#1a1a2e] mb-2">Golden Coffee ERP</h1>
        <p className="text-center text-gray-500 mb-6 text-sm">نظام متكامل لإدارة مطاحن ومصانع البن</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الدور الوظيفي</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]"
            >
              <option value="ADMIN">مدير النظام</option>
              <option value="FACTORY">مدير المصنع</option>
              <option value="WAREHOUSE">مدير المخزن</option>
              <option value="SALES">مدير المبيعات</option>
              <option value="ACCOUNTANT">محاسب</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e94560] text-white py-3 rounded-lg font-semibold hover:bg-[#c73e54] transition-colors disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
