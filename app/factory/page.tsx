import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Printer, Flame, ShoppingBag } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProductionForm } from '@/components/production-form'
import { PurchaseForm } from '@/components/purchase-form'

export const dynamic = 'force-dynamic'

export default async function FactoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [productions, purchases, products, suppliers, stages, warehouses] = await Promise.all([
    prisma.production.findMany({
      include: { items: { include: { product: true } }, rawProduct: true, creator: true },
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
    prisma.productionStage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ])

  const rawProducts = products.filter((p) => p.type === 'RAW')
  const finishedProducts = products.filter((p) => p.type === 'FINISHED')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">المصنع</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          البن الأخضر بيدخل بأمر شراء ← تحميص وطحن بأمر تصنيع ← منتج نهائي للمخزن
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* أوامر التصنيع */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-5 pb-3">
              <Flame className="w-5 h-5 text-[#e94560]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">أوامر التصنيع</h3>
              <span className="text-xs text-gray-400">({productions.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                    <th className="p-3 font-medium">رقم الأمر</th>
                    <th className="p-3 font-medium">الخامة</th>
                    <th className="p-3 font-medium">المرحلة</th>
                    <th className="p-3 font-medium">الناتج</th>
                    <th className="p-3 font-medium">التاريخ</th>
                    <th className="p-3 font-medium no-print">طباعة</th>
                  </tr>
                </thead>
                <tbody>
                  {productions.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش أوامر تصنيع لسه.</td></tr>
                  )}
                  {productions.map((prod) => (
                    <tr key={prod.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="p-3 font-semibold tabular-nums">{prod.orderNo}</td>
                      <td className="p-3">
                        {prod.rawProduct ? `${prod.rawProduct.name} (${prod.rawUsed} ${prod.rawProduct.unit})` : `${prod.rawUsed} كجم`}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-50 text-orange-600">{prod.stage}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {prod.items.map((item) => (
                            <span key={item.id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                              {item.product.name} +{item.quantity}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-gray-400 text-xs tabular-nums">
                        {new Date(prod.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-3 no-print">
                        <Link
                          href={`/print/production/${prod.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline"
                        >
                          <Printer className="w-3.5 h-3.5" /> أمر تصنيع
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* فواتير الشراء */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-5 pb-3">
              <ShoppingBag className="w-5 h-5 text-[#0f3460]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">أوامر الشراء (توريد البن الأخضر)</h3>
              <span className="text-xs text-gray-400">({purchases.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                    <th className="p-3 font-medium">رقم الفاتورة</th>
                    <th className="p-3 font-medium">المورد</th>
                    <th className="p-3 font-medium">الأصناف</th>
                    <th className="p-3 font-medium">الإجمالي</th>
                    <th className="p-3 font-medium">التاريخ</th>
                    <th className="p-3 font-medium no-print">طباعة</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش فواتير شراء لسه.</td></tr>
                  )}
                  {purchases.map((pur) => (
                    <tr key={pur.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="p-3 font-semibold tabular-nums">{pur.invoiceNo}</td>
                      <td className="p-3">{pur.supplier.name}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {pur.items.map((item) => (
                            <span key={item.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                              {item.product.name} {item.quantity} {item.product.unit}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-semibold tabular-nums">{Number(pur.totalAmount).toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 text-gray-400 text-xs tabular-nums">
                        {new Date(pur.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-3 no-print">
                        <Link
                          href={`/print/purchase/${pur.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline"
                        >
                          <Printer className="w-3.5 h-3.5" /> أمر شراء
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ProductionForm
            rawProducts={rawProducts.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, unit: p.unit }))}
            finishedProducts={finishedProducts.map((p) => ({ id: p.id, name: p.name, unit: p.unit }))}
            stages={stages.map((s) => s.name)}
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
          />
          <PurchaseForm
            products={rawProducts.map((p) => ({ id: p.id, name: p.name, unit: p.unit }))}
            suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
          />

          <div className="bg-white p-5 rounded-xl shadow-sm">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">رصيد الخامات</h3>
            <div className="space-y-2">
              {rawProducts.map((p) => (
                <div key={p.id} className="flex justify-between text-sm pb-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700">{p.name}</span>
                  <span className={`font-bold tabular-nums ${p.quantity <= p.minStock ? 'text-red-600' : 'text-green-600'}`}>
                    {p.quantity} {p.unit}
                  </span>
                </div>
              ))}
              {rawProducts.length === 0 && <p className="text-sm text-gray-500">مفيش خامات — ابدأ بأمر شراء.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
