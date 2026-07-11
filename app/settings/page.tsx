import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [suppliers, salesPoints, productCount, userCount] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.salesPoint.findMany({ orderBy: { name: 'asc' } }),
    prisma.product.count(),
    prisma.user.count(),
  ])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a2e]">⚙️ الإعدادات</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm text-center">
          <p className="text-3xl font-bold text-[#0f3460]">{userCount}</p>
          <p className="text-sm text-gray-500">مستخدمين</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm text-center">
          <p className="text-3xl font-bold text-[#0f3460]">{productCount}</p>
          <p className="text-sm text-gray-500">أصناف</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm text-center">
          <p className="text-3xl font-bold text-[#0f3460]">{suppliers.length}</p>
          <p className="text-sm text-gray-500">موردين</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm text-center">
          <p className="text-3xl font-bold text-[#0f3460]">{salesPoints.length}</p>
          <p className="text-sm text-gray-500">نقاط بيع</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">🏢 الموردين</h3>
          <div className="divide-y divide-gray-100">
            {suppliers.length === 0 && <p className="p-6 text-sm text-gray-500">مفيش موردين مسجّلين.</p>}
            {suppliers.map((s) => (
              <div key={s.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.phone || '—'} · {s.address || '—'}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{Number(s.totalPurchases).toFixed(2)} ج.م</p>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`text-xs ${i < s.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">📍 نقاط البيع</h3>
          <div className="divide-y divide-gray-100">
            {salesPoints.length === 0 && <p className="p-6 text-sm text-gray-500">مفيش نقاط بيع.</p>}
            {salesPoints.map((sp) => (
              <div key={sp.id} className="p-4">
                <p className="font-semibold text-sm">{sp.name}</p>
                <p className="text-xs text-gray-400">
                  {sp.address || '—'} · {sp.phone || '—'} · المدير: {sp.manager || '—'}
                </p>
                <span className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-semibold ${sp.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {sp.isActive ? 'نشطة' : 'معطّلة'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
