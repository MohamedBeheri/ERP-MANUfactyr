import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, Printer, Image as ImageIcon, Truck } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureStockStages } from '@/lib/stock-stages'
import { PurchaseForm } from '@/components/purchase-form'
import { effectivePermissions, canDoAction } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// المشتريات: أوامر شراء أي مكوّن من بنك الأصناف (بن أخضر/محمص/عطارة/نكهات/تغليف)
// التوريد بيدخل تلقائيًا لمخزن مرحلة الصنف، والدفع للمورد (فوري/آجل/جزئي) بيتتبع كمستحق.
export default async function PurchasesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  await ensureStockStages()
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canAdd = canDoAction(perms, 'purchases', 'add')

  const [purchases, products, suppliers, warehouses, supplierBal] = await Promise.all([
    prisma.purchase.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { supplier: true, items: { include: { product: true } } },
    }),
    // كل الأصناف القابلة للشراء من بنك الأصناف (التوليفات والمنتجات النهائية بتتصنع مش بتتشترى)
    prisma.product.findMany({
      where: { isActive: true, itemKind: { in: ['GREEN', 'ROASTED', 'SPICE', 'FLAVOR', 'PACKAGING', 'CAFE_MATERIAL'] } },
      orderBy: [{ itemKind: 'asc' }, { name: 'asc' }],
    }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.supplier.aggregate({ _sum: { balance: true } }),
  ])

  const totalPurchases = purchases.reduce((s, p) => s + Number(p.totalAmount), 0)
  const totalPaid = purchases.reduce((s, p) => s + Number(p.paidAmount), 0)
  const owedToSuppliers = Number(supplierBal._sum.balance) || 0

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">المشتريات</h1>
        <p className="text-sm text-gray-500 mt-0.5">أوامر شراء مكوّنات بنك الأصناف — التوريد بيدخل مخزن الصنف تلقائيًا والدفع للمورد متتبَّع</p>
      </div>

      {/* ملخص */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المشتريات', value: `${totalPurchases.toLocaleString('ar-EG')} ج.م`, cls: 'text-[#0f3460]' },
          { label: 'المدفوع للموردين', value: `${totalPaid.toLocaleString('ar-EG')} ج.م`, cls: 'text-green-700' },
          { label: 'مستحق للموردين', value: `${owedToSuppliers.toLocaleString('ar-EG')} ج.م`, cls: owedToSuppliers > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'عدد أوامر الشراء', value: `${purchases.length}`, cls: 'text-[#0f3460]' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <ShoppingBag className="w-5 h-5 text-[#0f3460]" />
            <h3 className="text-base font-bold text-[#1a1a2e]">أوامر الشراء</h3>
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
                  <th className="p-3 font-medium">الدفع للمورد</th>
                  <th className="p-3 font-medium no-print"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش أوامر شراء لسه — اعمل أول أمر من الفورم.</td></tr>
                )}
                {purchases.map((pur) => (
                  <tr key={pur.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-semibold tabular-nums">{pur.invoiceNo}</td>
                    <td className="p-3">{pur.supplier.name}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {pur.items.map((item) => (
                          <span key={item.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {item.product.name} {Number(item.quantity)} {item.product.unit}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 font-semibold tabular-nums">{Number(pur.totalAmount).toLocaleString('ar-EG')} ج.م</td>
                    <td className="p-3">
                      {(() => {
                        const owed = Number(pur.totalAmount) - Number(pur.paidAmount)
                        const cls = owed <= 0 ? 'bg-green-50 text-green-600' : Number(pur.paidAmount) > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className={`w-fit px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{pur.paymentMethod}</span>
                            {owed > 0 && <span className="text-[10px] text-red-600 tabular-nums">مستحق {owed.toLocaleString('ar-EG')} ج.م</span>}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="p-3 no-print">
                      <div className="flex items-center gap-2">
                        {pur.invoiceImage && (
                          <a href={pur.invoiceImage} target="_blank" className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium hover:underline">
                            <ImageIcon className="w-3.5 h-3.5" /> الفاتورة
                          </a>
                        )}
                        <Link href={`/print/purchase/${pur.id}`} className="inline-flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline">
                          <Printer className="w-3.5 h-3.5" /> أمر شراء
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {canAdd && (
            <PurchaseForm
              products={products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, itemKind: p.itemKind }))}
              suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
              warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
            />
          )}

          {/* مستحقات الموردين */}
          <div className="bg-white p-5 rounded-xl shadow-sm">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-[#0f3460]" /> الموردين والمستحق</h3>
            <div className="space-y-2">
              {suppliers.map((s) => (
                <div key={s.id} className="flex justify-between text-sm pb-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700">{s.name}</span>
                  <span className={`font-bold tabular-nums ${Number(s.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {Number(s.balance).toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              ))}
              {suppliers.length === 0 && <p className="text-sm text-gray-500">مفيش موردين — ضيفهم من الإعدادات.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
