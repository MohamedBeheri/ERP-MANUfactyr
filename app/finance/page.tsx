import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Package, Users, Truck, Flame, Wallet, Warehouse as WarehouseIcon } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExportButtons } from '@/components/export-buttons'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [products, warehouses, customers, delegates, productions, totalSales, totalPurchases, cashSales, creditSales] =
    await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        include: { category: true, stocks: { include: { warehouse: true } } },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      prisma.warehouse.findMany({
        where: { isActive: true },
        include: { stocks: { include: { product: true } } },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.customer.findMany({ where: { isActive: true }, orderBy: { balance: 'desc' } }),
      prisma.delegate.findMany({
        where: { isActive: true },
        include: {
          deliveryOrders: { select: { status: true } },
          settlements: { select: { cashAmount: true, creditAmount: true, soldQty: true, returnedQty: true } },
        },
      }),
      prisma.production.findMany({
        include: { rawProduct: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.invoice.aggregate({ _sum: { netAmount: true }, where: { status: 'COMPLETED' } }),
      prisma.purchase.aggregate({ _sum: { totalAmount: true } }),
      prisma.invoice.aggregate({ _sum: { netAmount: true }, where: { type: 'CASH', status: 'COMPLETED' } }),
      prisma.invoice.aggregate({ _sum: { netAmount: true }, where: { type: 'CREDIT', status: 'COMPLETED' } }),
    ])

  const sales = Number(totalSales._sum.netAmount) || 0
  const purchases = Number(totalPurchases._sum.totalAmount) || 0
  const cash = Number(cashSales._sum.netAmount) || 0
  const credit = Number(creditSales._sum.netAmount) || 0
  const totalDebt = customers.reduce((s, c) => s + Number(c.balance), 0)
  const stockValue = products.reduce((s, p) => s + p.quantity * Number(p.costPrice), 0)
  const totalProduced = productions.reduce((s, p) => s + p.items.reduce((a, i) => a + i.quantity, 0), 0)
  const totalRawUsed = productions.reduce((s, p) => s + p.rawUsed, 0)

  /* صفوف التصدير */
  const productRows = products.map((p) => [
    p.name,
    p.category?.name || '—',
    p.type === 'RAW' ? 'خام' : 'نهائي',
    p.quantity,
    p.unit,
    Number(p.sellPrice).toFixed(2),
    Number(p.wholesalePrice).toFixed(2),
    (p.quantity * Number(p.costPrice)).toFixed(2),
  ])
  const customerRows = customers.map((c) => [
    c.name,
    c.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي',
    c.phone || '—',
    Number(c.balance).toFixed(2),
    Number(c.totalPurchases).toFixed(2),
  ])
  const delegateRows = delegates.map((d) => {
    const dCash = d.settlements.reduce((s, st) => s + Number(st.cashAmount), 0)
    const dCredit = d.settlements.reduce((s, st) => s + Number(st.creditAmount), 0)
    return [
      d.name,
      d.carNumber || '—',
      d.route || '—',
      d.deliveryOrders.length,
      dCash.toFixed(2),
      dCredit.toFixed(2),
      Number(d.commissionDue).toFixed(2),
    ]
  })
  const productionRows = productions.map((p) => [
    p.orderNo,
    p.rawProduct?.name || '—',
    p.rawUsed,
    p.stage,
    p.items.map((i) => `${i.product.name} ×${i.quantity}`).join(' + '),
    new Date(p.createdAt).toLocaleDateString('ar-EG'),
  ])

  const allExportRows: (string | number)[][] = [
    ['— ملخص عام —', ''],
    ['إجمالي المبيعات', sales.toFixed(2)],
    ['إجمالي المشتريات', purchases.toFixed(2)],
    ['نقدي', cash.toFixed(2)],
    ['آجل', credit.toFixed(2)],
    ['إجمالي الديون', totalDebt.toFixed(2)],
    ['قيمة المخزون', stockValue.toFixed(2)],
    ['إجمالي الإنتاج (وحدات)', totalProduced],
    ['الخام المستخدم (كجم)', totalRawUsed],
  ]

  return (
    <div className="p-6 space-y-6 print-area">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">التقرير الشامل</h1>
          <p className="text-sm text-gray-500 mt-0.5">منتجات · مخازن · عملاء · مناديب · سيارات · ديون · تصنيع · مبيعات</p>
        </div>
        <ExportButtons fileName="التقرير-الشامل" headers={['البيان', 'القيمة']} rows={allExportRows} />
      </div>

      {/* ملخص عام */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي المبيعات', value: `${fmt(sales)} ج.م`, color: 'text-green-600' },
          { label: 'إجمالي المشتريات', value: `${fmt(purchases)} ج.م`, color: 'text-red-600' },
          { label: 'صافي الربح', value: `${fmt(sales - purchases)} ج.م`, color: sales - purchases >= 0 ? 'text-green-600' : 'text-red-600' },
          { label: 'قيمة المخزون', value: `${fmt(stockValue)} ج.م`, color: 'text-[#0f3460]' },
          { label: 'محصّل نقدي', value: `${fmt(cash)} ج.م`, color: 'text-emerald-600' },
          { label: 'آجل (مستحق)', value: `${fmt(credit)} ج.م`, color: 'text-yellow-700' },
          { label: 'ديون العملاء', value: `${fmt(totalDebt)} ج.م`, color: 'text-red-600' },
          { label: 'إنتاج كلي', value: `${fmt(totalProduced)} وحدة`, color: 'text-purple-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={`text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* المنتجات والأصناف */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#0f3460]" />
            <h3 className="text-base font-bold text-[#1a1a2e]">المنتجات والأصناف ({products.length})</h3>
          </div>
          <ExportButtons
            fileName="تقرير-المنتجات"
            headers={['الصنف', 'التصنيف', 'النوع', 'الرصيد', 'الوحدة', 'سعر قطاعي', 'سعر جملة', 'قيمة المخزون']}
            rows={productRows}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">الصنف</th>
                <th className="p-3 font-medium">التصنيف</th>
                <th className="p-3 font-medium">النوع</th>
                <th className="p-3 font-medium">الرصيد الكلي</th>
                <th className="p-3 font-medium">التوزيع على المخازن</th>
                <th className="p-3 font-medium">قطاعي / جملة</th>
                <th className="p-3 font-medium">قيمة الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold">{p.name}</td>
                  <td className="p-3 text-gray-500">{p.category?.name || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.type === 'RAW' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                      {p.type === 'RAW' ? 'خام' : 'نهائي'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`font-bold tabular-nums ${p.quantity <= p.minStock ? 'text-red-600' : ''}`}>
                      {p.quantity} {p.unit}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {p.stocks.filter((s) => s.quantity > 0).map((s) => `${s.warehouse.name}: ${s.quantity}`).join(' · ') || '—'}
                  </td>
                  <td className="p-3 tabular-nums text-gray-600">
                    {Number(p.sellPrice).toFixed(2)} / {Number(p.wholesalePrice).toFixed(2)}
                  </td>
                  <td className="p-3 tabular-nums font-semibold">{fmt(p.quantity * Number(p.costPrice))} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* المخازن */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <WarehouseIcon className="w-5 h-5 text-[#0f3460]" />
          <h3 className="text-base font-bold text-[#1a1a2e]">المخازن ({warehouses.length})</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {warehouses.map((w) => {
            const whValue = w.stocks.reduce((s, st) => s + st.quantity * Number(st.product.costPrice), 0)
            const itemCount = w.stocks.filter((s) => s.quantity > 0).length
            return (
              <div key={w.id} className="border border-gray-100 rounded-lg p-4">
                <p className="font-bold text-sm flex items-center gap-2">
                  {w.name}
                  {w.isDefault && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-semibold">افتراضي</span>}
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">أصناف بها رصيد</span><span className="font-semibold tabular-nums">{itemCount}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">قيمة المخزون</span><span className="font-semibold tabular-nums">{fmt(whValue)} ج.م</span></div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* العملاء والديون */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#e94560]" />
            <h3 className="text-base font-bold text-[#1a1a2e]">العملاء والديون ({customers.length})</h3>
            <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">
              إجمالي الديون: {fmt(totalDebt)} ج.م
            </span>
          </div>
          <ExportButtons
            fileName="تقرير-العملاء-والديون"
            headers={['العميل', 'النوع', 'التليفون', 'الرصيد المدين', 'إجمالي المشتريات']}
            rows={customerRows}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">العميل</th>
                <th className="p-3 font-medium">النوع</th>
                <th className="p-3 font-medium">التليفون</th>
                <th className="p-3 font-medium">الرصيد المدين (آجل)</th>
                <th className="p-3 font-medium">إجمالي المشتريات</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold">{c.name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.customerType === 'WHOLESALE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                      {c.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 tabular-nums">{c.phone || '—'}</td>
                  <td className="p-3">
                    <span className={`font-bold tabular-nums ${Number(c.balance) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {fmt(Number(c.balance))} ج.م
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{fmt(Number(c.totalPurchases))} ج.م</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">مفيش عملاء لسه.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* المناديب والسيارات */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-bold text-[#1a1a2e]">المناديب والسيارات ({delegates.length})</h3>
          </div>
          <ExportButtons
            fileName="تقرير-المناديب"
            headers={['المندوب', 'العربية', 'خط السير', 'الجولات', 'نقدي', 'آجل', 'عمولة مستحقة']}
            rows={delegateRows}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">المندوب</th>
                <th className="p-3 font-medium">العربية</th>
                <th className="p-3 font-medium">خط السير</th>
                <th className="p-3 font-medium">الجولات</th>
                <th className="p-3 font-medium">محصّل نقدي</th>
                <th className="p-3 font-medium">آجل</th>
                <th className="p-3 font-medium">عمولة مستحقة</th>
              </tr>
            </thead>
            <tbody>
              {delegates.map((d) => {
                const dCash = d.settlements.reduce((s, st) => s + Number(st.cashAmount), 0)
                const dCredit = d.settlements.reduce((s, st) => s + Number(st.creditAmount), 0)
                return (
                  <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-semibold">{d.name}</td>
                    <td className="p-3 text-gray-500 tabular-nums">{d.carNumber || '—'}</td>
                    <td className="p-3 text-gray-500">{d.route || '—'}</td>
                    <td className="p-3 tabular-nums">{d.deliveryOrders.length}</td>
                    <td className="p-3 tabular-nums text-green-700">{fmt(dCash)} ج.م</td>
                    <td className="p-3 tabular-nums text-yellow-700">{fmt(dCredit)} ج.م</td>
                    <td className="p-3 tabular-nums font-semibold text-[#e94560]">{fmt(Number(d.commissionDue))} ج.م</td>
                  </tr>
                )
              })}
              {delegates.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">مفيش مناديب لسه.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* التصنيع */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-bold text-[#1a1a2e]">التصنيع ({productions.length})</h3>
            <span className="text-xs text-gray-400">
              خام مستخدم: {fmt(totalRawUsed)} كجم · إنتاج: {fmt(totalProduced)} وحدة
            </span>
          </div>
          <ExportButtons
            fileName="تقرير-التصنيع"
            headers={['رقم الأمر', 'الخامة', 'الكمية المستخدمة', 'المرحلة', 'الناتج', 'التاريخ']}
            rows={productionRows}
          />
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
              </tr>
            </thead>
            <tbody>
              {productions.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold tabular-nums">{p.orderNo}</td>
                  <td className="p-3">{p.rawProduct ? `${p.rawProduct.name} (${p.rawUsed} ${p.rawProduct.unit})` : `${p.rawUsed} كجم`}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-50 text-orange-600">{p.stage}</span>
                  </td>
                  <td className="p-3 text-xs text-gray-600">
                    {p.items.map((i) => `${i.product.name} ×${i.quantity}`).join('، ')}
                  </td>
                  <td className="p-3 text-gray-400 text-xs tabular-nums">{new Date(p.createdAt).toLocaleDateString('ar-EG')}</td>
                </tr>
              ))}
              {productions.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">مفيش أوامر تصنيع لسه.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
