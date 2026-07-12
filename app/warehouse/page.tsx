import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, PackageSearch } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultWarehouseId } from '@/lib/warehouse'
import { StocktakeForm } from '@/components/stocktake-form'
import { ExportButtons } from '@/components/export-buttons'

export const dynamic = 'force-dynamic'

export default async function WarehousePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  await getDefaultWarehouseId() // يضمن وجود مخزن افتراضي وترحيل الأرصدة القديمة

  const [products, warehouseIns, warehouseOuts, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { stocks: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.warehouseIn.findMany({
      include: { product: true, creator: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.warehouseOut.findMany({
      include: { product: true, creator: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ])

  const stockRows = products.map((p) => [
    p.name,
    p.type === 'RAW' ? 'خام' : 'منتج نهائي',
    p.quantity,
    p.unit,
    p.minStock,
    Number(p.costPrice).toFixed(2),
    (p.quantity * Number(p.costPrice)).toFixed(2),
  ])

  const totalStockValue = products.reduce((s, p) => s + p.quantity * Number(p.costPrice), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">المخزن</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            البضاعة بتدخل بأمر شراء (خامات) أو أمر تصنيع (منتجات) وبتخرج بفواتير بيع أو تحميل عربيات — والجرد بيسوّي الفروقات
          </p>
        </div>
        <ExportButtons
          fileName="جرد-المخزن"
          headers={['الصنف', 'النوع', 'الكمية', 'الوحدة', 'الحد الأدنى', 'تكلفة الوحدة', 'قيمة المخزون']}
          rows={stockRows}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* جدول المخزون */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden print-area">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-2">
                <PackageSearch className="w-5 h-5 text-[#0f3460]" />
                <h3 className="text-base font-bold text-[#1a1a2e]">رصيد المخزون</h3>
              </div>
              <p className="text-sm text-gray-500">
                قيمة المخزون: <span className="font-bold text-[#1a1a2e] tabular-nums">{totalStockValue.toLocaleString('ar-EG')} ج.م</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                    <th className="p-3 font-medium">الصنف</th>
                    <th className="p-3 font-medium">النوع</th>
                    <th className="p-3 font-medium">الكمية</th>
                    <th className="p-3 font-medium">الحد الأدنى</th>
                    <th className="p-3 font-medium">تكلفة الوحدة</th>
                    <th className="p-3 font-medium">قيمة الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="p-3 font-semibold">
                        {p.name}
                        {warehouses.length > 1 && (
                          <p className="text-[11px] text-gray-400 font-normal mt-0.5">
                            {p.stocks
                              .filter((s) => s.quantity > 0)
                              .map((s) => `${warehouses.find((w) => w.id === s.warehouseId)?.name}: ${s.quantity}`)
                              .join(' · ') || 'مفيش رصيد موزّع'}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.type === 'RAW' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                          {p.type === 'RAW' ? 'خام' : 'منتج نهائي'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`font-bold tabular-nums ${p.quantity <= p.minStock ? 'text-red-600' : 'text-[#1a1a2e]'}`}>
                          {p.quantity} {p.unit}
                        </span>
                        {p.quantity <= p.minStock && (
                          <span className="mr-2 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">تحت الحد</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-500 tabular-nums">{p.minStock}</td>
                      <td className="p-3 text-gray-500 tabular-nums">{Number(p.costPrice).toFixed(2)}</td>
                      <td className="p-3 font-semibold tabular-nums">{(p.quantity * Number(p.costPrice)).toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش أصناف — ضيفها من الإعدادات وابدأ بأمر شراء.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* حركات المخزن */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 no-print">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 pb-3">
                <ArrowDownToLine className="w-5 h-5 text-green-600" />
                <h3 className="text-base font-bold text-[#1a1a2e]">إذون الإضافة (وارد)</h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {warehouseIns.length === 0 && <p className="p-5 text-sm text-gray-500">مفيش حركات وارد.</p>}
                {warehouseIns.map((entry) => (
                  <div key={entry.id} className="p-3.5 px-5 flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-green-700 tabular-nums">
                        +{entry.quantity} {entry.product.unit} — {entry.product.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{entry.source}</p>
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">
                      {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 pb-3">
                <ArrowUpFromLine className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-[#1a1a2e]">إذون الصرف (صادر)</h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {warehouseOuts.length === 0 && <p className="p-5 text-sm text-gray-500">مفيش حركات صادر.</p>}
                {warehouseOuts.map((entry) => (
                  <div key={entry.id} className="p-3.5 px-5 flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-red-600 tabular-nums">
                        -{entry.quantity} {entry.product.unit} — {entry.product.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{entry.target} · {entry.reason}</p>
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">
                      {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 no-print">
          <StocktakeForm
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              unit: p.unit,
              stocksByWarehouse: Object.fromEntries(p.stocks.map((s) => [s.warehouseId, s.quantity])),
            }))}
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
          />

          <div className="bg-white p-5 rounded-xl shadow-sm">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">إزاي البضاعة بتتحرك؟</h3>
            <ol className="space-y-2.5 text-sm text-gray-600 list-none">
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>البن الأخضر بيدخل <Link href="/factory" className="text-[#0f3460] font-medium hover:underline">بأمر شراء</Link> من مورد</span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>أمر التصنيع بيصرف الخام وبيضيف المنتج النهائي</span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>الصرف بيتم بفاتورة بيع أو أمر تحميل عربية</span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                <span>الجرد الدوري بيسوّي أي فرق بين الفعلي والمسجّل</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
