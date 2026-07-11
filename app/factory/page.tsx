import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProductionForm } from '@/components/production-form'
import { PurchaseForm } from '@/components/purchase-form'

export default async function FactoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [productions, purchases, products, suppliers] = await Promise.all([
    prisma.production.findMany({
      include: { items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.purchase.findMany({
      include: { supplier: true, items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  const rawProducts = products.filter((p) => p.type === 'RAW')
  const finishedProducts = products.filter((p) => p.type === 'FINISHED')

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a2e]">🏭 المصنع</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">📦 أوامر التصنيع</h3>
            <div className="divide-y divide-gray-100">
              {productions.length === 0 && (
                <p className="p-6 text-sm text-gray-500">مفيش أوامر تصنيع لسه.</p>
              )}
              {productions.map((prod) => (
                <div key={prod.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-[#1a1a2e]">{prod.orderNo}</p>
                      <p className="text-sm text-gray-500">
                        خام مستخدم: {prod.rawUsed} كجم · تكلفة تشغيل: {Number(prod.opCost).toFixed(2)} ج.م
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {prod.items.map((item) => (
                          <span key={item.id} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                            {item.product.name}: +{item.quantity} {item.product.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(prod.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">🛒 فواتير الشراء</h3>
            <div className="divide-y divide-gray-100">
              {purchases.length === 0 && (
                <p className="p-6 text-sm text-gray-500">مفيش فواتير شراء لسه.</p>
              )}
              {purchases.map((pur) => (
                <div key={pur.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-[#1a1a2e]">{pur.invoiceNo}</p>
                      <p className="text-sm text-gray-500">
                        المورد: {pur.supplier.name} · الإجمالي: {Number(pur.totalAmount).toFixed(2)} ج.م
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {pur.items.map((item) => (
                          <span key={item.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {item.product.name}: {item.quantity} {item.product.unit} × {Number(item.unitPrice).toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(pur.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ProductionForm
            rawProducts={rawProducts.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, unit: p.unit }))}
            finishedProducts={finishedProducts.map((p) => ({ id: p.id, name: p.name, unit: p.unit }))}
          />
          <PurchaseForm
            products={rawProducts.map((p) => ({ id: p.id, name: p.name, unit: p.unit }))}
            suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          />
        </div>
      </div>
    </div>
  )
}
