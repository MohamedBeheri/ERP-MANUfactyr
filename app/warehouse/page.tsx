import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function WarehousePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [products, warehouseIns, warehouseOuts] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.warehouseIn.findMany({
      include: { product: true, creator: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.warehouseOut.findMany({
      include: { product: true, creator: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const rawProducts = products.filter((p) => p.type === 'RAW')
  const finishedProducts = products.filter((p) => p.type === 'FINISHED')

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a2e]">📦 المخزن</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">🟤 المواد الخام</h3>
          <div className="space-y-3">
            {rawProducts.map((p) => (
              <div key={p.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400">تكلفة: {Number(p.costPrice).toFixed(2)} ج.م/{p.unit}</p>
                </div>
                <div className="text-left">
                  <p className={`font-bold text-lg ${p.quantity <= p.minStock ? 'text-red-600' : 'text-green-600'}`}>
                    {p.quantity}
                  </p>
                  <p className="text-xs text-gray-400">{p.unit} (حد أدنى: {p.minStock})</p>
                </div>
              </div>
            ))}
            {rawProducts.length === 0 && <p className="text-sm text-gray-500">مفيش مواد خام.</p>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">☕ المنتجات النهائية</h3>
          <div className="space-y-3">
            {finishedProducts.map((p) => (
              <div key={p.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400">
                    تكلفة: {Number(p.costPrice).toFixed(2)} · بيع: {Number(p.sellPrice).toFixed(2)} ج.م/{p.unit}
                  </p>
                </div>
                <div className="text-left">
                  <p className={`font-bold text-lg ${p.quantity <= p.minStock ? 'text-red-600' : 'text-green-600'}`}>
                    {p.quantity}
                  </p>
                  <p className="text-xs text-gray-400">{p.unit} (حد أدنى: {p.minStock})</p>
                </div>
              </div>
            ))}
            {finishedProducts.length === 0 && <p className="text-sm text-gray-500">مفيش منتجات نهائية.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">📥 آخر الوارد</h3>
          <div className="divide-y divide-gray-100">
            {warehouseIns.length === 0 && <p className="p-6 text-sm text-gray-500">مفيش حركات وارد.</p>}
            {warehouseIns.map((entry) => (
              <div key={entry.id} className="p-4 flex justify-between">
                <div>
                  <p className="font-semibold text-sm text-green-700">+{entry.quantity} {entry.product.unit} {entry.product.name}</p>
                  <p className="text-xs text-gray-400">{entry.source}</p>
                </div>
                <span className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleDateString('ar-EG')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">📤 آخر الصادر</h3>
          <div className="divide-y divide-gray-100">
            {warehouseOuts.length === 0 && <p className="p-6 text-sm text-gray-500">مفيش حركات صادر.</p>}
            {warehouseOuts.map((entry) => (
              <div key={entry.id} className="p-4 flex justify-between">
                <div>
                  <p className="font-semibold text-sm text-red-600">-{entry.quantity} {entry.product.unit} {entry.product.name}</p>
                  <p className="text-xs text-gray-400">{entry.target} · {entry.reason}</p>
                </div>
                <span className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleDateString('ar-EG')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
