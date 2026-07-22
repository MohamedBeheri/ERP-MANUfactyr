import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Package, Users, Truck, Flame, Warehouse as WarehouseIcon, ShoppingCart, Boxes, BarChart3, Trophy } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExportButtons } from '@/components/export-buttons'
import { ReportDateFilter } from '@/components/report-date-filter'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const pct = (a: number, b: number) => (b ? +((a / b) * 100).toFixed(1) : 0)
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

// سطر في شلال قائمة الدخل
function PnlRow({ label, value, bold, muted, accent }: { label: string; value: number; bold?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${accent ? 'border-t border-gray-100 mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${muted ? 'text-gray-400' : accent || bold ? 'font-bold text-[#1a1a2e]' : 'text-gray-600'}`}>{label}</span>
      <span className={`tabular-nums ${accent ? 'text-base font-extrabold text-[#0f3460]' : bold ? 'font-bold' : muted ? 'text-gray-400' : 'font-semibold'}`}>
        EGP {fmt(value)}
      </span>
    </div>
  )
}

// سطر مؤشر في البطاقات الجانبية
function KpiLine({ label, value, color = 'text-[#1a1a2e]' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  // ===== مدة التقرير (افتراضي: آخر ٣٠ يوم) =====
  const today = new Date()
  const defFrom = new Date(today); defFrom.setDate(defFrom.getDate() - 29)
  const fromStr = searchParams.from || isoDay(defFrom)
  const toStr = searchParams.to || isoDay(today)
  const fromDate = new Date(fromStr + 'T00:00:00')
  const toDate = new Date(toStr + 'T23:59:59.999')
  const period = { gte: fromDate, lte: toDate }

  const [
    products, warehouses, customers, delegates, productions,
    // ===== بيانات الأرباح والخسائر (مقيّدة بالمدة) =====
    invAgg, invItemsCogs, supplyAgg, supplyItemsCogs, returnsAgg, purchasesPeriodAgg,
    suppliersBal, keyAccountsBal,
  ] =
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
      // إيرادات الفواتير خلال المدة
      prisma.invoice.aggregate({
        _sum: { netAmount: true, totalAmount: true },
        _count: true,
        where: { status: 'COMPLETED', createdAt: period },
      }),
      // بنود الفواتير لحساب تكلفة البضاعة (بسعر التكلفة الحالي للصنف)
      prisma.invoiceItem.findMany({
        where: { invoice: { status: 'COMPLETED', createdAt: period } },
        select: { quantity: true, product: { select: { costPrice: true } } },
      }),
      // توريدات كبار الموردين خلال المدة
      prisma.keyAccountSupply.aggregate({
        _sum: { netAmount: true, totalAmount: true },
        _count: true,
        where: { createdAt: period },
      }),
      prisma.keyAccountSupplyItem.findMany({
        where: { supply: { createdAt: period } },
        select: { quantity: true, product: { select: { costPrice: true } } },
      }),
      // مرتجعات المبيعات خلال المدة
      prisma.deliveryReturn.aggregate({ _sum: { totalValue: true }, _count: true, where: { createdAt: period } }),
      // مشتريات المدة
      prisma.purchase.aggregate({ _sum: { totalAmount: true, paidAmount: true }, _count: true, where: { createdAt: period } }),
      // أرصدة لحظية (كل الوقت)
      prisma.supplier.aggregate({ _sum: { balance: true } }),
      prisma.keyAccount.aggregate({ _sum: { balance: true } }),
    ])

  // ===== حسابات قائمة الدخل (الأرباح والخسائر) =====
  const invGross = Number(invAgg._sum.totalAmount) || 0
  const invNet = Number(invAgg._sum.netAmount) || 0
  const invDiscount = Math.max(0, invGross - invNet)
  const invCount = invAgg._count || 0
  const supplyGross = Number(supplyAgg._sum.totalAmount) || 0
  const supplyNet = Number(supplyAgg._sum.netAmount) || 0
  const supplyDiscount = Math.max(0, supplyGross - supplyNet)
  const supplyCount = supplyAgg._count || 0
  const salesReturns = Number(returnsAgg._sum.totalValue) || 0

  const grossSales = invGross + supplyGross
  const totalDiscount = invDiscount + supplyDiscount
  const netSales = +(invNet + supplyNet - salesReturns).toFixed(2)
  const otherRevenue = 0
  const totalRevenue = +(netSales + otherRevenue).toFixed(2)

  const cogsInvoices = invItemsCogs.reduce((s, i) => s + i.quantity * Number(i.product.costPrice), 0)
  const cogsSupplies = supplyItemsCogs.reduce((s, i) => s + i.quantity * Number(i.product.costPrice), 0)
  const totalCogs = +(cogsInvoices + cogsSupplies).toFixed(2)
  const grossProfit = +(totalRevenue - totalCogs).toFixed(2)

  const opexTotal = 0 // لا يوجد سجل مصروفات بعد
  const netProfit = +(grossProfit - opexTotal).toFixed(2)

  const invoiceTotalCount = invCount + supplyCount
  const avgInvoice = invoiceTotalCount ? +(netSales / invoiceTotalCount).toFixed(2) : 0

  const purchasesPeriod = Number(purchasesPeriodAgg._sum.totalAmount) || 0
  const purchasesPaid = Number(purchasesPeriodAgg._sum.paidAmount) || 0
  const payableSuppliers = Number(suppliersBal._sum.balance) || 0
  const receivableCustomers = customers.reduce((s, c) => s + Number(c.balance), 0) + (Number(keyAccountsBal._sum.balance) || 0)

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
    [`— قائمة الدخل من ${fromStr} إلى ${toStr} —`, ''],
    ['إجمالي المبيعات (قبل الخصم)', grossSales.toFixed(2)],
    ['الخصومات', totalDiscount.toFixed(2)],
    ['مرتجعات المبيعات', salesReturns.toFixed(2)],
    ['صافي المبيعات', netSales.toFixed(2)],
    ['إجمالي الإيرادات', totalRevenue.toFixed(2)],
    ['تكلفة البضاعة المباعة (COGS)', totalCogs.toFixed(2)],
    ['إجمالي الربح', grossProfit.toFixed(2)],
    ['المصروفات التشغيلية', opexTotal.toFixed(2)],
    ['صافي الربح', netProfit.toFixed(2)],
    ['— مؤشرات —', ''],
    ['نسبة تكلفة البضاعة %', pct(totalCogs, netSales)],
    ['هامش الربح الإجمالي %', pct(grossProfit, totalRevenue)],
    ['هامش الربح الصافي %', pct(netProfit, totalRevenue)],
    ['متوسط قيمة الفاتورة', avgInvoice.toFixed(2)],
    ['عدد الفواتير/التوريدات', invoiceTotalCount],
    ['— المشتريات والذمم —', ''],
    ['مشتريات الفترة', purchasesPeriod.toFixed(2)],
    ['المدفوع منها', purchasesPaid.toFixed(2)],
    ['مستحق للموردين (كل الوقت)', payableSuppliers.toFixed(2)],
    ['مستحق لنا من العملاء (كل الوقت)', receivableCustomers.toFixed(2)],
    ['قيمة المخزون بالتكلفة', stockValue.toFixed(2)],
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6 print-area">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">الأرباح والخسائر الشاملة</h1>
          <p className="text-sm text-gray-500 mt-0.5">قائمة دخل كاملة للفترة — الإيرادات · تكلفة البضاعة · الربح · الذمم · المخزون</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportDateFilter from={fromStr} to={toStr} />
          <ExportButtons fileName={`قائمة-الدخل-${fromStr}_${toStr}`} headers={['البيان', 'القيمة']} rows={allExportRows} />
        </div>
      </div>

      {/* ===== قائمة الدخل الشاملة (زي التقرير الشامل بتاع الكافيه) ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* العمود الأساسي: شلال الأرباح والخسائر */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 space-y-5 order-2 xl:order-1">
          {/* الإيرادات */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💰</span>
              <h3 className="text-base font-bold text-[#0f3460]">الإيرادات</h3>
            </div>
            <PnlRow label="إجمالي المبيعات (قبل الخصم)" value={grossSales} />
            {totalDiscount > 0 && <PnlRow label="(−) الخصومات" value={-totalDiscount} muted />}
            {salesReturns > 0 && <PnlRow label="(−) مرتجعات المبيعات" value={-salesReturns} muted />}
            <PnlRow label="= صافي المبيعات" value={netSales} bold />
            {otherRevenue > 0 && <PnlRow label="(+) إيرادات أخرى" value={otherRevenue} muted />}
            <PnlRow label="إجمالي الإيرادات" value={totalRevenue} accent />
          </div>

          {/* تكلفة البضاعة المباعة */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Boxes className="w-5 h-5 text-[#0f3460]" />
              <h3 className="text-base font-bold text-[#0f3460]">تكلفة البضاعة المباعة (COGS)</h3>
            </div>
            <PnlRow label="تكلفة مكوّنات المبيعات (بسعر التكلفة)" value={totalCogs} />
            <PnlRow label="إجمالي تكلفة البضاعة" value={totalCogs} accent />
          </div>

          {/* إجمالي الربح */}
          <div className="rounded-xl bg-blue-50/70 px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#0f3460]">إجمالي الربح (Gross Profit)</p>
              <p className="text-[11px] text-gray-500">هامش إجمالي {pct(grossProfit, totalRevenue)}%</p>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-[#0f3460] tabular-nums">{fmt(grossProfit)} <span className="text-xs font-bold">ج.م</span></p>
          </div>

          {/* المصروفات التشغيلية */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧾</span>
              <h3 className="text-base font-bold text-[#0f3460]">المصروفات التشغيلية</h3>
            </div>
            <p className="text-xs text-gray-400 italic py-1">لا مصروفات مسجّلة في هذه الفترة</p>
            <PnlRow label="إجمالي المصروفات" value={opexTotal} accent />
          </div>

          {/* صافي الربح */}
          <div className="rounded-xl bg-gradient-to-l from-[#0f3460] to-[#16498a] px-4 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#e9b44c]" />
              <div>
                <p className="text-sm font-bold">صافي الربح (Net Profit)</p>
                <p className="text-[11px] text-white/70">هامش صافي {pct(netProfit, totalRevenue)}%</p>
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold tabular-nums">{fmt(netProfit)} <span className="text-xs font-bold">ج.م</span></p>
          </div>
        </div>

        {/* العمود الجانبي: المؤشرات + الذمم + المخزون */}
        <div className="space-y-6 order-1 xl:order-2">
          {/* مؤشرات محاسبية */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-[#0f3460]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">مؤشرات محاسبية</h3>
            </div>
            <div className="space-y-2.5">
              <KpiLine label="نسبة تكلفة البضاعة (Food Cost)" value={`${pct(totalCogs, netSales)}%`} color="text-amber-600" />
              <KpiLine label="هامش الربح الإجمالي" value={`${pct(grossProfit, totalRevenue)}%`} color="text-green-600" />
              <KpiLine label="هامش الربح الصافي" value={`${pct(netProfit, totalRevenue)}%`} color="text-green-600" />
              <KpiLine label="متوسط قيمة الفاتورة" value={`${fmt(avgInvoice)} ج.م`} color="text-[#0f3460]" />
              <KpiLine label="عدد الفواتير/التوريدات" value={fmt(invoiceTotalCount)} color="text-[#0f3460]" />
            </div>
          </div>

          {/* المشتريات والذمم */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-5 h-5 text-[#0f3460]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">المشتريات والذمم</h3>
            </div>
            <div className="space-y-2.5">
              <KpiLine label="مشتريات الفترة" value={`${fmt(purchasesPeriod)} ج.م`} />
              <KpiLine label="المدفوع منها" value={`${fmt(purchasesPaid)} ج.م`} />
              <KpiLine label="مستحق للموردين (كل الوقت)" value={`${fmt(payableSuppliers)} ج.م`} color="text-red-600" />
              <KpiLine label="مستحق لنا من العملاء (كل الوقت)" value={`${fmt(receivableCustomers)} ج.م`} color="text-amber-600" />
            </div>
            <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
              أرقام الذمم لحظية (كل الأرصدة المفتوحة) وليست محصورة بالفترة المحددة أعلاه.
            </p>
          </div>

          {/* المخزون الحالي */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-[#0f3460]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">المخزون الحالي <span className="text-xs font-normal text-gray-400">(لحظي)</span></h3>
            </div>
            <KpiLine label="قيمة المخزون بالتكلفة" value={`${fmt(stockValue)} ج.م`} color="text-[#0f3460]" />
          </div>
        </div>
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
