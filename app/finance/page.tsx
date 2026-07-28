import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import {
  Package, Users, Truck, Flame, Warehouse as WarehouseIcon, ShoppingCart, Boxes,
  BarChart3, Trophy, TrendingUp, TrendingDown, CircleDollarSign, Receipt,
  Factory, CreditCard, Banknote, ArrowDownRight, ArrowUpRight, Landmark,
  FileText, AlertTriangle, Scale,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExportButtons } from '@/components/export-buttons'
import { ReportDateFilter } from '@/components/report-date-filter'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const pct = (a: number, b: number) => (b ? +((a / b) * 100).toFixed(1) : 0)
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const money = (n: number) => `${fmt(n)} ج.م`

function PnlRow({ label, value, bold, muted, accent, negative }: { label: string; value: number; bold?: boolean; muted?: boolean; accent?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${accent ? 'border-t border-gray-100 mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${muted ? 'text-gray-400' : accent || bold ? 'font-bold text-[#1a1a2e]' : 'text-gray-600'}`}>{label}</span>
      <span className={`tabular-nums ${accent ? 'text-base font-extrabold text-[#0f3460]' : bold ? 'font-bold' : muted ? 'text-gray-400' : 'font-semibold'} ${negative ? 'text-red-600' : ''}`}>
        {negative && value > 0 ? '(' : ''}EGP {fmt(Math.abs(value))}{negative && value > 0 ? ')' : ''}
      </span>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color = 'text-[#0f3460]', bg = 'bg-white' }: { label: string; value: string; icon: any; color?: string; bg?: string }) {
  return (
    <div className={`${bg} rounded-xl shadow-sm p-4 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('600', '50').replace('700', '50').replace('500', '50')}`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, badge, iconColor = 'text-[#0f3460]' }: { icon: any; title: string; badge?: string; iconColor?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-5 h-5 ${iconColor}`} />
      <h3 className="text-base font-bold text-[#1a1a2e]">{title}</h3>
      {badge && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">{badge}</span>}
    </div>
  )
}

export default async function ReportsPage({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const today = new Date()
  const defFrom = new Date(today); defFrom.setDate(defFrom.getDate() - 29)
  const fromStr = searchParams.from || isoDay(defFrom)
  const toStr = searchParams.to || isoDay(today)
  const fromDate = new Date(fromStr + 'T00:00:00')
  const toDate = new Date(toStr + 'T23:59:59.999')
  const period = { gte: fromDate, lte: toDate }

  const [
    products, warehouses, customers, delegates, productions,
    invAgg, invItemsCogs, supplyAgg, supplyItemsCogs, returnsAgg, purchasesPeriodAgg,
    suppliersBal, keyAccountsBal,
    paymentVouchers, cashFlows, liabilities,
    invoicesByDay, productionInputs,
  ] = await Promise.all([
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
        settlements: { where: { createdAt: period }, select: { cashAmount: true, creditAmount: true, soldQty: true, returnedQty: true, commission: true } },
        invoices: { where: { status: 'COMPLETED', createdAt: period }, select: { netAmount: true } },
      },
    }),
    prisma.production.findMany({
      where: { createdAt: period },
      include: { rawProduct: true, items: { include: { product: true } }, operation: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.aggregate({
      _sum: { netAmount: true, totalAmount: true, paidAmount: true },
      _count: true,
      where: { status: 'COMPLETED', createdAt: period },
    }),
    prisma.invoiceItem.findMany({
      where: { invoice: { status: 'COMPLETED', createdAt: period } },
      select: { quantity: true, product: { select: { costPrice: true } } },
    }),
    prisma.keyAccountSupply.aggregate({
      _sum: { netAmount: true, totalAmount: true },
      _count: true,
      where: { createdAt: period },
    }),
    prisma.keyAccountSupplyItem.findMany({
      where: { supply: { createdAt: period } },
      select: { quantity: true, product: { select: { costPrice: true } } },
    }),
    prisma.deliveryReturn.aggregate({ _sum: { totalValue: true }, _count: true, where: { createdAt: period } }),
    prisma.purchase.aggregate({ _sum: { totalAmount: true, paidAmount: true }, _count: true, where: { createdAt: period } }),
    prisma.supplier.aggregate({ _sum: { balance: true } }),
    prisma.keyAccount.aggregate({ _sum: { balance: true } }),
    // سندات الصرف من الخزينة (المصروفات الفعلية)
    prisma.paymentVoucher.findMany({
      where: { status: 'APPROVED', createdAt: period },
      include: { category: { select: { name: true, code: true, activity: true, affectsPL: true } } },
    }),
    // التدفقات النقدية
    prisma.cashFlow.findMany({
      where: { createdAt: period },
      select: { type: true, amount: true, activity: true },
    }),
    // الالتزامات النشطة
    prisma.liability.findMany({
      where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
      select: { totalAmount: true, paidAmount: true, remainingAmount: true, type: true },
    }),
    // المبيعات اليومية (لتحليل الترند)
    prisma.invoice.findMany({
      where: { status: 'COMPLETED', createdAt: period },
      select: { netAmount: true, createdAt: true, type: true },
    }),
    // مدخلات الإنتاج
    prisma.productionInput.findMany({
      where: { production: { createdAt: period } },
      select: { quantity: true, product: { select: { name: true, costPrice: true, unit: true } } },
    }),
  ])

  // ===== حسابات قائمة الدخل =====
  const invGross = Number(invAgg._sum.totalAmount) || 0
  const invNet = Number(invAgg._sum.netAmount) || 0
  const invDiscount = Math.max(0, invGross - invNet)
  const invCount = invAgg._count || 0
  const invPaid = Number(invAgg._sum.paidAmount) || 0
  const supplyGross = Number(supplyAgg._sum.totalAmount) || 0
  const supplyNet = Number(supplyAgg._sum.netAmount) || 0
  const supplyDiscount = Math.max(0, supplyGross - supplyNet)
  const supplyCount = supplyAgg._count || 0
  const salesReturns = Number(returnsAgg._sum.totalValue) || 0

  const grossSales = invGross + supplyGross
  const totalDiscount = invDiscount + supplyDiscount
  const netSales = +(invNet + supplyNet - salesReturns).toFixed(2)
  const totalRevenue = +netSales.toFixed(2)

  const cogsInvoices = invItemsCogs.reduce((s, i) => s + i.quantity * Number(i.product.costPrice), 0)
  const cogsSupplies = supplyItemsCogs.reduce((s, i) => s + i.quantity * Number(i.product.costPrice), 0)
  const totalCogs = +(cogsInvoices + cogsSupplies).toFixed(2)
  const grossProfit = +(totalRevenue - totalCogs).toFixed(2)

  // ===== المصروفات التشغيلية الفعلية من سندات الصرف =====
  const opexVouchers = paymentVouchers.filter(v => v.category?.affectsPL !== false)
  const opexByCategory = new Map<string, number>()
  opexVouchers.forEach(v => {
    const catName = v.category?.name || 'مصروفات أخرى'
    opexByCategory.set(catName, (opexByCategory.get(catName) || 0) + Number(v.amount))
  })
  const opexTotal = opexVouchers.reduce((s, v) => s + Number(v.amount), 0)
  const opexSorted = Array.from(opexByCategory.entries()).sort((a, b) => b[1] - a[1])
  const netProfit = +(grossProfit - opexTotal).toFixed(2)

  // ===== سندات الصرف حسب النشاط =====
  const vouchersByActivity = { OPERATING: 0, INVESTING: 0, FINANCING: 0 }
  paymentVouchers.forEach(v => {
    vouchersByActivity[v.activity as keyof typeof vouchersByActivity] += Number(v.amount)
  })

  // ===== مؤشرات المبيعات =====
  const invoiceTotalCount = invCount + supplyCount
  const avgInvoice = invoiceTotalCount ? +(netSales / invoiceTotalCount).toFixed(2) : 0
  const cashSales = invoicesByDay.filter(i => i.type === 'CASH').reduce((s, i) => s + Number(i.netAmount), 0)
  const creditSales = invoicesByDay.filter(i => i.type === 'CREDIT').reduce((s, i) => s + Number(i.netAmount), 0)

  // ===== المشتريات والذمم =====
  const purchasesPeriod = Number(purchasesPeriodAgg._sum.totalAmount) || 0
  const purchasesPaid = Number(purchasesPeriodAgg._sum.paidAmount) || 0
  const payableSuppliers = Number(suppliersBal._sum.balance) || 0
  const receivableCustomers = customers.reduce((s, c) => s + Number(c.balance), 0)
  const receivableKA = Number(keyAccountsBal._sum.balance) || 0
  const totalReceivable = receivableCustomers + receivableKA

  // ===== المخزون =====
  const stockValue = products.reduce((s, p) => s + p.quantity * Number(p.costPrice), 0)
  const rawProducts = products.filter(p => p.type === 'RAW')
  const finishedProducts = products.filter(p => p.type !== 'RAW')
  const lowStockCount = products.filter(p => p.quantity <= p.minStock && p.quantity > 0).length
  const outOfStockCount = products.filter(p => p.quantity <= 0).length

  // ===== التصنيع =====
  const totalProduced = productions.reduce((s, p) => s + p.items.reduce((a, i) => a + i.quantity, 0), 0)
  const totalRawUsed = productions.reduce((s, p) => s + p.rawUsed, 0)
  const productionCost = productionInputs.reduce((s, inp) => s + inp.quantity * Number(inp.product.costPrice), 0)
  const yieldRate = totalRawUsed > 0 ? pct(totalProduced, totalRawUsed) : 0

  // ===== المناديب =====
  const delegateCash = delegates.reduce((s, d) => s + d.settlements.reduce((a, st) => a + Number(st.cashAmount), 0), 0)
  const delegateCredit = delegates.reduce((s, d) => s + d.settlements.reduce((a, st) => a + Number(st.creditAmount), 0), 0)
  const delegateCommission = delegates.reduce((s, d) => s + d.settlements.reduce((a, st) => a + Number(st.commission), 0), 0)
  const delegateSales = delegates.reduce((s, d) => s + d.invoices.reduce((a, inv) => a + Number(inv.netAmount), 0), 0)
  const delegateReturns = delegates.reduce((s, d) => s + d.settlements.reduce((a, st) => a + st.returnedQty, 0), 0)

  // ===== التدفقات النقدية =====
  const cfIn = cashFlows.filter(c => c.type === 'IN').reduce((s, c) => s + Number(c.amount), 0)
  const cfOut = cashFlows.filter(c => c.type === 'OUT').reduce((s, c) => s + Number(c.amount), 0)
  const cfNet = cfIn - cfOut

  // ===== الالتزامات =====
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.totalAmount), 0)
  const paidLiabilities = liabilities.reduce((s, l) => s + Number(l.paidAmount), 0)
  const remainingLiabilities = liabilities.reduce((s, l) => s + Number(l.remainingAmount), 0)

  // ===== العملاء =====
  const totalDebt = receivableCustomers
  const topDebtors = customers.filter(c => Number(c.balance) > 0).slice(0, 5)

  // ===== التصدير الشامل =====
  const allExportRows: (string | number)[][] = [
    [`— قائمة الدخل من ${fromStr} إلى ${toStr} —`, ''],
    ['إجمالي المبيعات (قبل الخصم)', grossSales.toFixed(2)],
    ['الخصومات', totalDiscount.toFixed(2)],
    ['مرتجعات المبيعات', salesReturns.toFixed(2)],
    ['صافي المبيعات', netSales.toFixed(2)],
    ['تكلفة البضاعة المباعة (COGS)', totalCogs.toFixed(2)],
    ['إجمالي الربح', grossProfit.toFixed(2)],
    ['— المصروفات التشغيلية —', ''],
    ...opexSorted.map(([cat, amt]) => [cat, amt.toFixed(2)] as [string, string]),
    ['إجمالي المصروفات', opexTotal.toFixed(2)],
    ['صافي الربح', netProfit.toFixed(2)],
    ['— مؤشرات —', ''],
    ['هامش الربح الإجمالي %', pct(grossProfit, totalRevenue)],
    ['هامش الربح الصافي %', pct(netProfit, totalRevenue)],
    ['نسبة تكلفة البضاعة %', pct(totalCogs, netSales)],
    ['متوسط قيمة الفاتورة', avgInvoice.toFixed(2)],
    ['— المخزون —', ''],
    ['قيمة المخزون بالتكلفة', stockValue.toFixed(2)],
    ['أصناف تحت الحد', lowStockCount],
    ['أصناف نفذت', outOfStockCount],
    ['— المشتريات والذمم —', ''],
    ['مشتريات الفترة', purchasesPeriod.toFixed(2)],
    ['مستحق للموردين', payableSuppliers.toFixed(2)],
    ['مستحق لنا من العملاء', totalReceivable.toFixed(2)],
    ['— التصنيع —', ''],
    ['أوامر التصنيع', productions.length],
    ['إجمالي الناتج', totalProduced],
    ['خامات مستخدمة', totalRawUsed],
    ['— المناديب —', ''],
    ['محصّل نقدي', delegateCash.toFixed(2)],
    ['محصّل آجل', delegateCredit.toFixed(2)],
    ['عمولات مستحقة', delegateCommission.toFixed(2)],
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6 print-area">
      {/* العنوان وفلتر المدة */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">التقرير الشامل</h1>
          <p className="text-sm text-gray-500 mt-0.5">نظرة تنفيذية شاملة — المبيعات · التكاليف · المصروفات · المخزون · التصنيع · المناديب · الخزينة · الالتزامات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportDateFilter from={fromStr} to={toStr} />
          <ExportButtons fileName={`التقرير-الشامل-${fromStr}_${toStr}`} headers={['البيان', 'القيمة']} rows={allExportRows} />
        </div>
      </div>

      {/* ===== بطاقات المؤشرات الرئيسية ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="صافي المبيعات" value={money(netSales)} icon={TrendingUp} color="text-green-600" />
        <KpiCard label="إجمالي الربح" value={money(grossProfit)} icon={BarChart3} color="text-blue-600" />
        <KpiCard label="المصروفات" value={money(opexTotal)} icon={TrendingDown} color="text-red-600" />
        <KpiCard label="صافي الربح" value={money(netProfit)} icon={Trophy} color={netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
        <KpiCard label="قيمة المخزون" value={money(stockValue)} icon={Package} color="text-purple-600" />
        <KpiCard label="ذمم مدينة" value={money(totalReceivable)} icon={CreditCard} color="text-amber-600" />
      </div>

      {/* ===== قائمة الدخل + المؤشرات ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* قائمة الدخل */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm p-5 sm:p-6 space-y-5">
          <SectionHeader icon={FileText} title="قائمة الأرباح والخسائر (P&L)" badge={`${fromStr} → ${toStr}`} />

          {/* الإيرادات */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-bold text-green-700">الإيرادات</h4>
            </div>
            <PnlRow label="إجمالي المبيعات (قبل الخصم)" value={grossSales} />
            {totalDiscount > 0 && <PnlRow label="(−) الخصومات" value={-totalDiscount} muted />}
            {salesReturns > 0 && <PnlRow label="(−) مرتجعات المبيعات" value={-salesReturns} muted />}
            <PnlRow label="= صافي المبيعات" value={netSales} bold />
            <PnlRow label="إجمالي الإيرادات" value={totalRevenue} accent />
          </div>

          {/* تكلفة البضاعة */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Boxes className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-bold text-amber-700">تكلفة البضاعة المباعة (COGS)</h4>
            </div>
            <PnlRow label="تكلفة مكوّنات المبيعات المباشرة" value={cogsInvoices} />
            {cogsSupplies > 0 && <PnlRow label="تكلفة توريدات كبار الموردين" value={cogsSupplies} />}
            <PnlRow label="إجمالي تكلفة البضاعة" value={totalCogs} accent />
          </div>

          {/* إجمالي الربح */}
          <div className="rounded-xl bg-blue-50/70 px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#0f3460]">إجمالي الربح (Gross Profit)</p>
              <p className="text-[11px] text-gray-500">هامش إجمالي {pct(grossProfit, totalRevenue)}%</p>
            </div>
            <p className="text-xl font-extrabold text-[#0f3460] tabular-nums">{fmt(grossProfit)} <span className="text-xs font-bold">ج.م</span></p>
          </div>

          {/* المصروفات التشغيلية */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              <h4 className="text-sm font-bold text-red-600">المصروفات التشغيلية</h4>
              <span className="text-[11px] text-gray-400 mr-auto">{opexVouchers.length} سند صرف</span>
            </div>
            {opexSorted.length > 0 ? (
              opexSorted.map(([cat, amt]) => <PnlRow key={cat} label={cat} value={amt} />)
            ) : (
              <p className="text-xs text-gray-400 italic py-1">لا توجد مصروفات مسجّلة في هذه الفترة</p>
            )}
            <PnlRow label="إجمالي المصروفات" value={opexTotal} accent />
          </div>

          {/* صافي الربح */}
          <div className={`rounded-xl px-4 py-4 flex items-center justify-between text-white ${netProfit >= 0 ? 'bg-gradient-to-l from-[#0f3460] to-[#16498a]' : 'bg-gradient-to-l from-red-700 to-red-500'}`}>
            <div className="flex items-center gap-2">
              <Trophy className={`w-5 h-5 ${netProfit >= 0 ? 'text-[#e9b44c]' : 'text-white/70'}`} />
              <div>
                <p className="text-sm font-bold">صافي الربح (Net Profit)</p>
                <p className="text-[11px] text-white/70">هامش صافي {pct(netProfit, totalRevenue)}%</p>
              </div>
            </div>
            <p className="text-xl font-extrabold tabular-nums">{fmt(netProfit)} <span className="text-xs font-bold">ج.م</span></p>
          </div>
        </div>

        {/* المؤشرات الجانبية */}
        <div className="space-y-4">
          {/* مؤشرات ربحية */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <SectionHeader icon={BarChart3} title="مؤشرات الربحية" />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">هامش الربح الإجمالي</span><span className={`text-sm font-bold tabular-nums ${pct(grossProfit, totalRevenue) >= 30 ? 'text-green-600' : 'text-amber-600'}`}>{pct(grossProfit, totalRevenue)}%</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">هامش الربح الصافي</span><span className={`text-sm font-bold tabular-nums ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pct(netProfit, totalRevenue)}%</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">نسبة تكلفة البضاعة</span><span className="text-sm font-bold tabular-nums text-amber-600">{pct(totalCogs, netSales)}%</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">نسبة المصروفات للإيرادات</span><span className="text-sm font-bold tabular-nums text-red-500">{pct(opexTotal, totalRevenue)}%</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">متوسط قيمة الفاتورة</span><span className="text-sm font-bold tabular-nums text-[#0f3460]">{money(avgInvoice)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">عدد الفواتير / التوريدات</span><span className="text-sm font-bold tabular-nums text-[#0f3460]">{fmt(invoiceTotalCount)}</span></div>
            </div>
          </div>

          {/* المبيعات: نقدي vs آجل */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <SectionHeader icon={Banknote} title="توزيع المبيعات" />
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">مبيعات نقدي</span><span className="text-sm font-bold tabular-nums text-green-600">{money(cashSales)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">مبيعات آجل</span><span className="text-sm font-bold tabular-nums text-amber-600">{money(creditSales)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">توريدات كبار</span><span className="text-sm font-bold tabular-nums text-blue-600">{money(supplyNet)}</span></div>
              {cashSales + creditSales > 0 && (
                <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${pct(cashSales, cashSales + creditSales)}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width: `${pct(creditSales, cashSales + creditSales)}%` }} />
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> نقدي {pct(cashSales, cashSales + creditSales)}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> آجل {pct(creditSales, cashSales + creditSales)}%</span>
              </div>
            </div>
          </div>

          {/* الذمم والتدفقات */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <SectionHeader icon={Scale} title="الذمم والالتزامات" />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">مستحق من العملاء</span><span className="text-sm font-bold tabular-nums text-amber-600">{money(receivableCustomers)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">مستحق من كبار الموردين</span><span className="text-sm font-bold tabular-nums text-amber-600">{money(receivableKA)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">مستحق للموردين</span><span className="text-sm font-bold tabular-nums text-red-600">{money(payableSuppliers)}</span></div>
              {remainingLiabilities > 0 && <div className="flex items-center justify-between"><span className="text-sm text-gray-500">التزامات قائمة</span><span className="text-sm font-bold tabular-nums text-red-600">{money(remainingLiabilities)}</span></div>}
              <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[#1a1a2e]">صافي المركز</span>
                <span className={`text-sm font-bold tabular-nums ${totalReceivable - payableSuppliers - remainingLiabilities >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {money(totalReceivable - payableSuppliers - remainingLiabilities)}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">أرقام لحظية غير مقيّدة بالفترة</p>
          </div>
        </div>
      </div>

      {/* ===== المشتريات والمخزون ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* المشتريات */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <SectionHeader icon={ShoppingCart} title="المشتريات" badge={`${purchasesPeriodAgg._count || 0} أمر`} />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">إجمالي المشتريات</span><span className="text-sm font-bold tabular-nums">{money(purchasesPeriod)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">المدفوع</span><span className="text-sm font-bold tabular-nums text-green-600">{money(purchasesPaid)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">المتبقي</span><span className="text-sm font-bold tabular-nums text-red-600">{money(purchasesPeriod - purchasesPaid)}</span></div>
            {purchasesPeriod > 0 && (
              <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="bg-green-500 h-full rounded-full" style={{ width: `${pct(purchasesPaid, purchasesPeriod)}%` }} />
              </div>
            )}
          </div>
        </div>

        {/* المخزون */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <SectionHeader icon={Package} title="المخزون" badge="لحظي" iconColor="text-purple-600" />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">قيمة المخزون بالتكلفة</span><span className="text-sm font-bold tabular-nums text-[#0f3460]">{money(stockValue)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">خامات ({rawProducts.length} صنف)</span><span className="text-sm font-bold tabular-nums">{money(rawProducts.reduce((s, p) => s + p.quantity * Number(p.costPrice), 0))}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">منتجات نهائية ({finishedProducts.length} صنف)</span><span className="text-sm font-bold tabular-nums">{money(finishedProducts.reduce((s, p) => s + p.quantity * Number(p.costPrice), 0))}</span></div>
            <div className="flex items-center gap-3 mt-2">
              {lowStockCount > 0 && <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold"><AlertTriangle className="w-3 h-3" />{lowStockCount} تحت الحد</span>}
              {outOfStockCount > 0 && <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 font-semibold"><AlertTriangle className="w-3 h-3" />{outOfStockCount} نفذ</span>}
              {lowStockCount === 0 && outOfStockCount === 0 && <span className="text-xs text-green-600 font-semibold">جميع الأصناف متوفرة</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ===== التصنيع والمناديب ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* التصنيع */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <SectionHeader icon={Factory} title="التصنيع" badge={`${productions.length} أمر`} iconColor="text-orange-500" />
          {productions.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">خامات مستخدمة</span><span className="text-sm font-bold tabular-nums">{fmt(totalRawUsed)} كجم</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">إجمالي الناتج</span><span className="text-sm font-bold tabular-nums text-green-600">{fmt(totalProduced)} وحدة</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">تكلفة مدخلات الإنتاج</span><span className="text-sm font-bold tabular-nums text-amber-600">{money(productionCost)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">نسبة الناتج/المدخل</span><span className="text-sm font-bold tabular-nums">{yieldRate}%</span></div>
              {/* آخر 5 أوامر */}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs text-gray-400 mb-2">آخر الأوامر</p>
                {productions.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1 text-xs">
                    <span className="text-gray-600">{p.orderNo} — {p.operation?.name || p.stage}</span>
                    <span className="tabular-nums text-gray-500">{p.items.map(i => `${i.product.name} ×${i.quantity}`).join('، ')}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">لا توجد أوامر تصنيع في هذه الفترة</p>
          )}
        </div>

        {/* المناديب */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <SectionHeader icon={Truck} title="أداء المناديب" badge={`${delegates.length} مندوب`} iconColor="text-sky-600" />
          {delegates.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">مبيعات المناديب</span><span className="text-sm font-bold tabular-nums text-green-600">{money(delegateSales)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">محصّل نقدي</span><span className="text-sm font-bold tabular-nums text-green-600">{money(delegateCash)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">محصّل آجل</span><span className="text-sm font-bold tabular-nums text-amber-600">{money(delegateCredit)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">مرتجعات</span><span className="text-sm font-bold tabular-nums text-red-500">{fmt(delegateReturns)} وحدة</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-500">عمولات مستحقة</span><span className="text-sm font-bold tabular-nums text-[#e94560]">{money(delegateCommission)}</span></div>
              {/* ترتيب أعلى 5 */}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs text-gray-400 mb-2">أعلى 5 مبيعات</p>
                {delegates.sort((a, b) => b.invoices.reduce((s, i) => s + Number(i.netAmount), 0) - a.invoices.reduce((s, i) => s + Number(i.netAmount), 0)).slice(0, 5).map(d => {
                  const dSales = d.invoices.reduce((s, i) => s + Number(i.netAmount), 0)
                  return dSales > 0 ? (
                    <div key={d.id} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-gray-600">{d.name}</span>
                      <span className="tabular-nums font-semibold text-green-600">{money(dSales)}</span>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">لا يوجد مناديب مسجّلين</p>
          )}
        </div>
      </div>

      {/* ===== الخزينة والتدفقات ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* التدفقات النقدية */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <SectionHeader icon={Landmark} title="التدفقات النقدية" iconColor="text-emerald-600" />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">إجمالي الوارد</span><span className="text-sm font-bold tabular-nums text-green-600">{money(cfIn)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">إجمالي المنصرف</span><span className="text-sm font-bold tabular-nums text-red-600">{money(cfOut)}</span></div>
            <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-[#1a1a2e]">صافي التدفق</span>
              <span className={`text-sm font-bold tabular-nums ${cfNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money(cfNet)}</span>
            </div>
            {/* حسب النشاط */}
            <div className="border-t border-gray-100 pt-3 mt-2">
              <p className="text-xs text-gray-400 mb-2">سندات الصرف حسب النشاط</p>
              <div className="flex items-center justify-between py-1 text-xs"><span className="text-gray-500">تشغيلي</span><span className="tabular-nums font-semibold text-red-500">{money(vouchersByActivity.OPERATING)}</span></div>
              <div className="flex items-center justify-between py-1 text-xs"><span className="text-gray-500">استثماري</span><span className="tabular-nums font-semibold text-blue-500">{money(vouchersByActivity.INVESTING)}</span></div>
              <div className="flex items-center justify-between py-1 text-xs"><span className="text-gray-500">تمويلي</span><span className="tabular-nums font-semibold text-purple-500">{money(vouchersByActivity.FINANCING)}</span></div>
            </div>
          </div>
        </div>

        {/* أكبر مديونيات */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <SectionHeader icon={Users} title="أكبر المديونيات" badge={`إجمالي: ${money(totalDebt)}`} iconColor="text-[#e94560]" />
          {topDebtors.length > 0 ? (
            <div className="space-y-1">
              {topDebtors.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm text-gray-700">{c.name}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-red-600">{money(Number(c.balance))}</span>
                </div>
              ))}
              {customers.filter(c => Number(c.balance) > 0).length > 5 && (
                <p className="text-[11px] text-gray-400 pt-1">+ {customers.filter(c => Number(c.balance) > 0).length - 5} عميل آخر</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">لا توجد مديونيات</p>
          )}
        </div>
      </div>

      {/* ===== جدول المخازن ===== */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <WarehouseIcon className="w-5 h-5 text-[#0f3460]" />
          <h3 className="text-base font-bold text-[#1a1a2e]">توزيع المخزون على المخازن</h3>
          <span className="text-xs text-gray-400">{warehouses.length} مخزن</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {warehouses.map(w => {
            const whValue = w.stocks.reduce((s, st) => s + st.quantity * Number(st.product.costPrice), 0)
            const itemCount = w.stocks.filter(s => s.quantity > 0).length
            return (
              <div key={w.id} className="border border-gray-100 rounded-lg p-4">
                <p className="font-bold text-sm flex items-center gap-2">
                  {w.name}
                  {w.isDefault && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-semibold">افتراضي</span>}
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">أصناف بها رصيد</span><span className="font-semibold tabular-nums">{itemCount}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">قيمة المخزون</span><span className="font-semibold tabular-nums">{money(whValue)}</span></div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ===== جدول المصروفات بالتفصيل ===== */}
      {opexSorted.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Receipt className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-bold text-[#1a1a2e]">تفصيل المصروفات حسب البند</h3>
            <span className="mr-auto text-xs text-gray-400 tabular-nums">{opexSorted.length} بند</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                  <th className="p-3 font-medium">#</th>
                  <th className="p-3 font-medium">البند</th>
                  <th className="p-3 font-medium text-left">المبلغ</th>
                  <th className="p-3 font-medium text-left">النسبة من الإيرادات</th>
                  <th className="p-3 font-medium text-left">النسبة من المصروفات</th>
                </tr>
              </thead>
              <tbody>
                {opexSorted.map(([cat, amt], i) => (
                  <tr key={cat} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="p-3 font-semibold">{cat}</td>
                    <td className="p-3 tabular-nums font-semibold text-red-600 text-left">{money(amt)}</td>
                    <td className="p-3 tabular-nums text-left">{pct(amt, totalRevenue)}%</td>
                    <td className="p-3 tabular-nums text-left">
                      <div className="flex items-center gap-2">
                        <span>{pct(amt, opexTotal)}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct(amt, opexTotal)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="p-3" />
                  <td className="p-3">الإجمالي</td>
                  <td className="p-3 tabular-nums text-red-600 text-left">{money(opexTotal)}</td>
                  <td className="p-3 tabular-nums text-left">{pct(opexTotal, totalRevenue)}%</td>
                  <td className="p-3 tabular-nums text-left">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
