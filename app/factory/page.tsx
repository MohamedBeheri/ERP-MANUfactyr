import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Printer, Flame, ShoppingBag, Blend, TrendingDown, Package2 } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProductionForm } from '@/components/production-form'
import { PurchaseForm } from '@/components/purchase-form'
import { RecipeManager } from '@/components/recipe-manager'

export const dynamic = 'force-dynamic'

const num = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 1 })

export default async function FactoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [productions, purchases, products, suppliers, stages, warehouses, recipes] = await Promise.all([
    prisma.production.findMany({
      include: {
        items: { include: { product: true } },
        inputs: { include: { product: true } },
        rawProduct: true,
        recipe: true,
        creator: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.purchase.findMany({
      include: { supplier: true, items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.productionStage.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.recipe.findMany({
      where: { isActive: true },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const rawProducts = products.filter((p) => p.type === 'RAW')

  // إحصائيات الإنتاج والهدر
  const roastingOrders = productions.filter((p) => p.lineType === 'ROASTING')
  const totalInput = productions.reduce((s, p) => s + p.inputWeight, 0)
  const totalOutput = productions.reduce((s, p) => s + p.outputWeight, 0)
  const totalWaste = productions.reduce((s, p) => s + p.wasteWeight, 0)
  const avgRoastWaste =
    roastingOrders.length > 0
      ? roastingOrders.reduce((s, p) => s + Number(p.wastePercent), 0) / roastingOrders.length
      : 0

  const productForms = products.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, unit: p.unit, type: p.type }))
  const recipeLite = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    lineType: r.lineType,
    outputName: r.outputName,
    roastLevel: r.roastLevel,
    grindType: r.grindType,
    expectedWaste: Number(r.expectedWaste),
    notes: r.notes,
    items: r.items.map((it) => ({ productId: it.productId, percentage: Number(it.percentage), productName: it.product.name })),
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">المصنع — خطوط الإنتاج</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          خط ١: بن أخضر ← تحميص (مع حساب الهدر) · خط ٢: بن محمّص ← خلط (BOM) ← طحن ← تعبئة
        </p>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Package2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-[#1a1a2e] tabular-nums">{num(totalInput)}</p>
            <p className="text-xs text-gray-500">إجمالي المدخلات</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Package2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-green-700 tabular-nums">{num(totalOutput)}</p>
            <p className="text-xs text-gray-500">إجمالي المنتج</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-orange-600 tabular-nums">{num(totalWaste)}</p>
            <p className="text-xs text-gray-500">إجمالي الهدر</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-red-600 tabular-nums">{avgRoastWaste.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">متوسط هدر التحميص</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
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
                    <th className="p-3 font-medium">الخط</th>
                    <th className="p-3 font-medium">التشغيلة</th>
                    <th className="p-3 font-medium">المدخل ← الناتج</th>
                    <th className="p-3 font-medium">الهدر</th>
                    <th className="p-3 font-medium no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {productions.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش أوامر تصنيع لسه.</td></tr>
                  )}
                  {productions.map((prod) => (
                    <tr key={prod.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 align-top">
                      <td className="p-3">
                        <p className="font-semibold tabular-nums">{prod.orderNo}</p>
                        <p className="text-[11px] text-gray-400">{prod.roastLevel || prod.grindType || prod.stage}</p>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${prod.lineType === 'ROASTING' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                          {prod.lineType === 'ROASTING' ? 'تحميص' : 'خلط وطحن'}
                        </span>
                      </td>
                      <td className="p-3 tabular-nums text-xs">
                        {prod.batchNo || '—'}
                        {prod.expiryDate && (
                          <p className="text-[10px] text-gray-400">صلاحية: {new Date(prod.expiryDate).toLocaleDateString('ar-EG')}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {prod.inputs.map((inp) => (
                            <span key={inp.id} className="text-[11px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded tabular-nums">
                              {inp.product.name} {inp.quantity}{Number(inp.percentage) > 0 ? ` (${Number(inp.percentage)}%)` : ''}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {prod.items.map((item) => (
                            <span key={item.id} className="text-[11px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded tabular-nums">
                              ← {item.product.name} +{item.quantity}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`tabular-nums font-semibold text-xs ${Number(prod.wastePercent) > 22 || (prod.lineType === 'ROASTING' && Number(prod.wastePercent) < 10 && prod.outputWeight > 0) ? 'text-red-600' : 'text-orange-600'}`}>
                          {prod.wasteWeight} ({Number(prod.wastePercent).toFixed(1)}%)
                        </span>
                      </td>
                      <td className="p-3 no-print">
                        <Link
                          href={`/print/production/${prod.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline"
                        >
                          <Printer className="w-3.5 h-3.5" /> بطاقة
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* الوصفات */}
          <RecipeManager recipes={recipeLite} products={products.map((p) => ({ id: p.id, name: p.name, type: p.type }))} />

          {/* أوامر الشراء */}
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
                    <th className="p-3 font-medium no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-500">مفيش فواتير شراء لسه.</td></tr>
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
                      <td className="p-3 no-print">
                        <Link href={`/print/purchase/${pur.id}`} className="inline-flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline">
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
            products={productForms}
            stages={stages.map((s) => s.name)}
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
            recipes={recipeLite}
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
