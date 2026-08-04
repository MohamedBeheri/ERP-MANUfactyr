import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingCart, Factory, Truck, PackageOpen, AlertTriangle, ChevronLeft, Globe,
  Warehouse, Building2, Wallet, Users, Gift, Coins, Clock, Crown, Undo2, Car,
  MapPin, ClipboardList, TrendingUp, TrendingDown, Banknote, ReceiptText,
  ShoppingBag, Scale, ArrowUpRight, ArrowDownRight, DollarSign, CreditCard,
  Boxes, FileSpreadsheet, Landmark, CircleDollarSign, BadgePercent, Coffee, Printer,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions } from '@/lib/permissions'
import { PeriodSelector } from '@/components/period-selector'
import { AlBadrLogo } from '@/components/albadr-logo'
import {
  SalesTrendChart, RevenueBreakdownChart, TopProductsBar, PaymentMethodsPie,
  ExpensesByCategoryChart, ProductionTrendChart, CashFlowChart,
} from '@/components/dashboard-charts'
import { RecentActivity } from '@/components/recent-activity'

export const dynamic = 'force-dynamic'

const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })
const pct = (part: number, whole: number) => whole > 0 ? ((part / whole) * 100).toFixed(1) : '0'

function buildPeriod(searchParams: { days?: string; from?: string; to?: string }) {
  if (searchParams.from && searchParams.to) {
    const from = new Date(searchParams.from)
    from.setHours(0, 0, 0, 0)
    const to = new Date(searchParams.to)
    to.setHours(23, 59, 59, 999)
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
    return { from, to, days, label: `من ${searchParams.from} إلى ${searchParams.to}` }
  }
  const days = Math.min(90, Math.max(1, Number(searchParams.days) || 7))
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  from.setHours(0, 0, 0, 0)
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  return { from, to, days, label: days === 1 ? 'اليوم' : `آخر ${days} يوم` }
}

export default async function DashboardPage({ searchParams: rawSearchParams }: { searchParams: Promise<{ days?: string; from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const { from, to, days, label } = buildPeriod(searchParams)
  const period = { gte: from, lte: to }

  if ((session.user as any).role === 'DELEGATE') {
    return <DelegateDashboard userId={(session.user as any).id} userName={session.user?.name || 'المندوب'} days={days} from={from} to={to} searchParams={searchParams} />
  }

  const perms = effectivePermissions((session.user as any).role, (session.user as any).permissions)
  const showOps = perms.some(p => ['sales', 'finance', 'warehouse', 'factory', 'delegates'].includes(p))

  const [
    invoices, productions, purchaseAgg, allProducts, activeDelegates,
    recentActivity, pendingOnline, activeTours, keyClaims, wasteAlerts,
    paymentVouchers, cashFlows, liabilities, customerCount, supplierPayAgg,
    kaPayAgg, creditCollections,
    periodSettlements, periodCollections, treasuries, pendingUnloadsCount,
    prevInvoices, prevVoucherAgg,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: period, status: 'COMPLETED' },
      include: { customer: { select: { name: true } }, items: { include: { product: { select: { name: true, costPrice: true, itemKind: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.production.findMany({
      where: { createdAt: period },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.purchase.aggregate({ where: { createdAt: period }, _sum: { totalAmount: true, paidAmount: true }, _count: true }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, quantity: true, minStock: true, unit: true, costPrice: true } }),
    prisma.delegate.count({ where: { isActive: true } }),
    prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { user: true } }),
    prisma.onlineOrder.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.deliveryOrder.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.keyAccount.aggregate({ where: { isActive: true }, _sum: { balance: true } }).catch(() => ({ _sum: { balance: 0 } })),
    prisma.production.count({ where: { wasteExceeded: true, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }).catch(() => 0),
    prisma.paymentVoucher.findMany({ where: { status: 'APPROVED', createdAt: period }, include: { category: { select: { name: true, activity: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.cashFlow.findMany({ where: { createdAt: period }, orderBy: { createdAt: 'asc' } }),
    prisma.liability.findMany({ where: { status: { in: ['ACTIVE', 'OVERDUE'] } }, select: { remainingAmount: true, status: true, type: true } }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.supplierPayment.aggregate({ where: { createdAt: period }, _sum: { amount: true } }),
    prisma.keyAccountPayment.aggregate({ where: { createdAt: period }, _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { createdAt: period, status: 'COMPLETED', type: 'CREDIT', paidAmount: { gt: 0 } }, _sum: { paidAmount: true } }),
    prisma.settlement.findMany({ where: { createdAt: period }, select: { cashAmount: true, cashOnlyAmount: true, instapayAmount: true, walletAmount: true } }).catch(() => []),
    prisma.collection.findMany({ where: { createdAt: period }, include: { paymentMethod: { select: { name: true, type: true } } } }).catch(() => []),
    prisma.treasury.findMany({ where: { isActive: true }, select: { name: true, type: true, balance: true } }).catch(() => []),
    prisma.unloadOrder.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.invoice.findMany({
      where: { createdAt: { gte: new Date(from.getTime() - (to.getTime() - from.getTime())), lt: from }, status: 'COMPLETED' },
      include: { items: { include: { product: { select: { costPrice: true } } } } },
    }).catch(() => []),
    prisma.paymentVoucher.aggregate({
      where: { status: 'APPROVED', createdAt: { gte: new Date(from.getTime() - (to.getTime() - from.getTime())), lt: from } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: 0 } })),
  ])

  // ─── KPIs ───
  const totalSales = invoices.reduce((s, i) => s + Number(i.netAmount), 0)
  const cashSales = invoices.filter(i => i.type === 'CASH').reduce((s, i) => s + Number(i.netAmount), 0)
  const creditSales = invoices.filter(i => i.type === 'CREDIT').reduce((s, i) => s + Number(i.netAmount), 0)
  const kaSales = Number(kaPayAgg._sum.amount) || 0
  const cogs = invoices.reduce((s, inv) => s + inv.items.reduce((a, it) => a + Number(it.quantity) * Number(it.product.costPrice), 0), 0)
  const grossProfit = totalSales - cogs
  const totalExpenses = paymentVouchers.reduce((s, v) => s + Number(v.amount), 0)
  const netProfit = grossProfit - totalExpenses

  // مقارنة بالفترة السابقة (نفس الطول) — نسبة التغيّر لكل مؤشر رئيسي
  const prevSales = prevInvoices.reduce((s: number, i: any) => s + Number(i.netAmount), 0)
  const prevCogs = prevInvoices.reduce((s: number, inv: any) => s + inv.items.reduce((a: number, it: any) => a + Number(it.quantity) * Number(it.product.costPrice), 0), 0)
  const prevGross = prevSales - prevCogs
  const prevExpenses = Number(prevVoucherAgg._sum.amount) || 0
  const prevNet = prevGross - prevExpenses
  const deltaPct = (cur: number, prev: number) => (prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : cur !== 0 ? 100 : null)
  const salesDelta = deltaPct(totalSales, prevSales)
  const grossDelta = deltaPct(grossProfit, prevGross)
  const expensesDelta = deltaPct(totalExpenses, prevExpenses)
  const netDelta = deltaPct(netProfit, prevNet)

  // مبيعات الكافيه في الفترة (أصناف CAFE_ITEM)
  const cafeSales = invoices.reduce(
    (s, inv) => s + inv.items.filter((it: any) => it.product.itemKind === 'CAFE_ITEM' && !it.isBonus).reduce((a: number, it: any) => a + Number(it.totalPrice), 0),
    0
  )
  const producedQty = productions.reduce((s, p) => s + p.items.reduce((a, i) => a + Number(i.quantity), 0), 0)
  const purchaseTotal = Number(purchaseAgg._sum.totalAmount) || 0
  const purchasePaid = Number(purchaseAgg._sum.paidAmount) || 0
  const lowStockProducts = allProducts.filter(p => Number(p.quantity) <= Number(p.minStock))
  const inventoryValue = allProducts.reduce((s, p) => s + Number(p.quantity) * Number(p.costPrice), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.remainingAmount), 0)
  const overdueCount = liabilities.filter(l => l.status === 'OVERDUE').length
  const keyClaimsTotal = Number(keyClaims._sum.balance) || 0
  const supPayTotal = Number(supplierPayAgg._sum.amount) || 0
  const kaPayTotal = Number(kaPayAgg._sum.amount) || 0
  const collectionsTotal = Number(creditCollections._sum.paidAmount) || 0

  // ─── حجم الفلوس بوسيلة الدفع (كاش/إنستا/محفظة/فيزا-شبكة) خلال الفترة ───
  let payCash = 0, payInsta = 0, payWallet = 0, payNetwork = 0
  // تسويات المناديب المفصّلة (القديمة بدون تفصيل = كاش)
  for (const s of periodSettlements) {
    const parts = Number(s.cashOnlyAmount) + Number(s.instapayAmount) + Number(s.walletAmount)
    if (parts === 0) payCash += Number(s.cashAmount)
    else {
      payCash += Number(s.cashOnlyAmount)
      payInsta += Number(s.instapayAmount)
      payWallet += Number(s.walletAmount)
    }
  }
  // سندات التحصيل المباشرة بالوسيلة
  for (const c of periodCollections) {
    const amt = Number(c.amount)
    if (c.paymentMethod.type === 'ELECTRONIC') payInsta += amt
    else if (c.paymentMethod.type === 'BANK') payNetwork += amt
    else payCash += amt
  }
  // مبيعات نقطة البيع المباشرة (غير المناديب) بوسيلة الدفع المسجّلة على الفاتورة
  for (const inv of invoices) {
    if ((inv as any).delegateId) continue // تحصيل المندوب اتحسب من تسويته
    const paid = Number(inv.paidAmount)
    if (paid <= 0) continue
    const pm = inv.paymentMethod || 'نقدي'
    if (pm.includes('انستا') || pm.includes('إنستا')) payInsta += paid
    else if (pm.includes('فيزا') || pm.includes('شبكة')) payNetwork += paid
    else if (pm.includes('محفظة')) payWallet += paid
    else payCash += paid
  }
  const treasuryTotal = treasuries.reduce((s: number, t: any) => s + Number(t.balance), 0)
  const mainTreasury = treasuries.filter((t: any) => t.type === 'MAIN_CASH').reduce((s: number, t: any) => s + Number(t.balance), 0)
  const clearingTreasury = treasuries.filter((t: any) => t.type === 'CLEARING_ACCOUNT').reduce((s: number, t: any) => s + Number(t.balance), 0)
  const bankTreasury = treasuries.filter((t: any) => t.type === 'BANK').reduce((s: number, t: any) => s + Number(t.balance), 0)

  // ─── تجميع المبيعات والمصروفات اليومية ───
  const dayMap = new Map<string, { sales: number; expenses: number; prodQty: number; prodOrders: number; cfIn: number; cfOut: number }>()
  const fillDay = (key: string) => {
    if (!dayMap.has(key)) dayMap.set(key, { sales: 0, expenses: 0, prodQty: 0, prodOrders: 0, cfIn: 0, cfOut: 0 })
    return dayMap.get(key)!
  }

  if (days === 1) {
    for (let h = 0; h < 24; h++) fillDay(`${h}:00`)
    invoices.forEach(inv => { fillDay(`${new Date(inv.createdAt).getHours()}:00`).sales += Number(inv.netAmount) })
    paymentVouchers.forEach(v => { fillDay(`${new Date(v.createdAt).getHours()}:00`).expenses += Number(v.amount) })
    productions.forEach(p => {
      const d = fillDay(`${new Date(p.createdAt).getHours()}:00`)
      d.prodOrders++
      d.prodQty += p.items.reduce((a, i) => a + Number(i.quantity), 0)
    })
    cashFlows.forEach(cf => {
      const d = fillDay(`${new Date(cf.createdAt).getHours()}:00`)
      if (cf.type === 'IN') d.cfIn += Number(cf.amount); else d.cfOut += Number(cf.amount)
    })
  } else {
    for (let i = 0; i < days; i++) {
      const dt = new Date(from)
      dt.setDate(from.getDate() + i)
      fillDay(dt.toISOString().slice(0, 10))
    }
    invoices.forEach(inv => { fillDay(new Date(inv.createdAt).toISOString().slice(0, 10)).sales += Number(inv.netAmount) })
    paymentVouchers.forEach(v => { fillDay(new Date(v.createdAt).toISOString().slice(0, 10)).expenses += Number(v.amount) })
    productions.forEach(p => {
      const d = fillDay(new Date(p.createdAt).toISOString().slice(0, 10))
      d.prodOrders++
      d.prodQty += p.items.reduce((a, i) => a + Number(i.quantity), 0)
    })
    cashFlows.forEach(cf => {
      const d = fillDay(new Date(cf.createdAt).toISOString().slice(0, 10))
      if (cf.type === 'IN') d.cfIn += Number(cf.amount); else d.cfOut += Number(cf.amount)
    })
  }
  const chartEntries = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const chartLabels = days === 1
    ? chartEntries.map(([k]) => k)
    : chartEntries.map(([k]) => new Date(k).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }))
  const chartSales = chartEntries.map(([, v]) => v.sales)
  const chartExpenses = chartEntries.map(([, v]) => v.expenses)
  const chartProdQty = chartEntries.map(([, v]) => v.prodQty)
  const chartProdOrders = chartEntries.map(([, v]) => v.prodOrders)
  const chartCfIn = chartEntries.map(([, v]) => v.cfIn)
  const chartCfOut = chartEntries.map(([, v]) => v.cfOut)

  // ─── المنتجات الأكثر مبيعًا ───
  const productAgg = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const inv of invoices) {
    for (const it of inv.items) {
      const prev = productAgg.get(it.productId) || { name: it.product.name, qty: 0, revenue: 0 }
      prev.qty += Number(it.quantity)
      prev.revenue += Number(it.totalPrice)
      productAgg.set(it.productId, prev)
    }
  }
  const topProducts = Array.from(productAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6)

  // ─── المصروفات حسب البند ───
  const expCatMap = new Map<string, number>()
  paymentVouchers.forEach(v => {
    const key = v.category?.name || 'بدون تصنيف'
    expCatMap.set(key, (expCatMap.get(key) || 0) + Number(v.amount))
  })
  const expensesByCategory = Array.from(expCatMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amount]) => ({ name, amount }))

  // ─── Alerts ───
  const alerts = [
    pendingOnline > 0 && perms.includes('store') && { href: '/online-orders', Icon: Globe, text: `${pendingOnline} طلب جديد من الموقع`, cls: 'bg-purple-50 text-purple-700 ring-purple-100' },
    activeTours > 0 && perms.includes('delegates') && { href: '/drivers', Icon: Truck, text: `${activeTours} عربية في الطريق`, cls: 'bg-sky-50 text-sky-700 ring-sky-100' },
    overdueCount > 0 && { href: '/treasury', Icon: AlertTriangle, text: `${overdueCount} التزام متأخر السداد`, cls: 'bg-red-50 text-red-700 ring-red-100' },
    wasteAlerts > 0 && perms.includes('factory') && { href: '/factory/produce', Icon: AlertTriangle, text: `${wasteAlerts} تشغيلة هدرها أعلى من الحد`, cls: 'bg-red-50 text-red-700 ring-red-100' },
    lowStockProducts.length > 0 && perms.includes('warehouse') && { href: '/warehouse', Icon: AlertTriangle, text: `${lowStockProducts.length} صنف تحت الحد الأدنى`, cls: 'bg-orange-50 text-orange-700 ring-orange-100' },
  ].filter(Boolean) as { href: string; Icon: any; text: string; cls: string }[]

  const quickActions = [
    { href: '/sales', label: 'بيع جديد', Icon: ShoppingCart, perm: 'sales' },
    { href: '/factory/produce', label: 'أمر تصنيع', Icon: Factory, perm: 'factory' },
    { href: '/delegates', label: 'تحميل عربية', Icon: Truck, perm: 'delegates' },
    { href: '/key-accounts', label: 'كبار الموردين', Icon: Building2, perm: 'keyaccounts' },
    { href: '/online-orders', label: 'طلبات الموقع', Icon: PackageOpen, perm: 'store' },
    { href: '/warehouse', label: 'المخزن', Icon: Warehouse, perm: 'warehouse' },
    { href: '/treasury', label: 'الخزينة', Icon: Landmark, perm: 'treasury' },
    { href: '/finance', label: 'التقارير', Icon: FileSpreadsheet, perm: 'finance' },
  ].filter(a => perms.includes(a.perm))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور'
  const firstName = (session.user.name || '').split(' ')[0]

  const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0'
  const grossMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : '0'

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* ─── Hero Banner ─── */}
      <div className="relative overflow-hidden rounded-3xl text-white p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 50%, #16213e 100%)' }}>
        <div className="absolute -left-10 -bottom-16 opacity-[0.05] pointer-events-none"><AlBadrLogo className="w-80 h-80" /></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#e9b44c]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">{greeting}{firstName ? `، ${firstName}` : ''}</h1>
            <p className="text-white/50 text-sm mt-1">
              {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}شركة البدر لتجارة البن
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              {quickActions.map(({ href, label, Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-[#e9b44c] hover:text-[#1a1a2e] text-xs font-bold transition-all duration-200 backdrop-blur">
                  <Icon className="w-3.5 h-3.5" />{label}
                </Link>
              ))}
            </div>
          </div>
          <PeriodSelector current={days} basePath="/dashboard" />
        </div>
      </div>

      {/* ─── Alerts ─── */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.map(({ href, Icon, text, cls }) => (
            <Link key={href + text} href={href} className={`group flex items-center justify-between gap-3 p-3.5 rounded-xl ring-1 transition-all hover:-translate-y-0.5 ${cls}`}>
              <span className="flex items-center gap-2 text-xs font-bold"><Icon className="w-4 h-4 shrink-0" />{text}</span>
              <ChevronLeft className="w-4 h-4 shrink-0 group-hover:-translate-x-1 transition-transform" />
            </Link>
          ))}
        </div>
      )}

      {showOps && (
        <>
          {/* ─── KPI Cards — صف أول: المالية الرئيسية ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="إجمالي المبيعات" value={egp(totalSales)} sub={`${fmt(invoices.length)} فاتورة`} Icon={Banknote} color="bg-blue-50 text-blue-600" href="/finance/sales" trend={null} delta={salesDelta} />
            <KpiCard label="إجمالي الربح" value={egp(grossProfit)} sub={`هامش ${grossMargin}%`} Icon={TrendingUp} color="bg-green-50 text-green-600" href="/finance" trend={grossProfit >= 0 ? 'up' : 'down'} delta={grossDelta} />
            <KpiCard label="المصروفات" value={egp(totalExpenses)} sub={`${fmt(paymentVouchers.length)} سند صرف`} Icon={FileSpreadsheet} color="bg-red-50 text-red-600" href="/finance/expenses" trend={null} delta={expensesDelta} deltaInverted />
            <KpiCard label="صافي الربح" value={egp(netProfit)} sub={`هامش ${profitMargin}%`} Icon={CircleDollarSign} color={netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'} href="/finance" trend={netProfit >= 0 ? 'up' : 'down'} delta={netDelta} />
          </div>

          {/* ─── KPI Cards — صف ثاني: التشغيل ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <MiniKpi label="محصّل نقدي" value={egp(cashSales)} Icon={Wallet} cls="text-green-600" />
            <MiniKpi label="مبيعات الكافيه" value={egp(cafeSales)} Icon={Coffee} cls="text-amber-700" />
            <MiniKpi label="آجل (مديونية)" value={egp(creditSales)} Icon={Scale} cls="text-amber-600" />
            <MiniKpi label="مشتريات الفترة" value={egp(purchaseTotal)} Icon={ShoppingBag} cls="text-orange-600" />
            <MiniKpi label="إنتاج الفترة" value={`${fmt(producedQty)} وحدة`} Icon={Factory} cls="text-purple-600" />
            <MiniKpi label="قيمة المخزون" value={egp(inventoryValue)} Icon={Boxes} cls="text-sky-600" />
            <MiniKpi label="التزامات قائمة" value={egp(totalLiabilities)} Icon={CreditCard} cls="text-red-600" />
          </div>

          {/* ─── P&L Waterfall Mini ─── */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1a1a2e] mb-4">ملخص الأرباح والخسائر — {label}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'الإيرادات', value: totalSales, cls: 'text-blue-600 bg-blue-50' },
                { label: 'تكلفة المبيعات', value: cogs, cls: 'text-orange-600 bg-orange-50' },
                { label: 'إجمالي الربح', value: grossProfit, cls: 'text-green-600 bg-green-50' },
                { label: 'المصروفات', value: totalExpenses, cls: 'text-red-600 bg-red-50' },
                { label: 'صافي الربح', value: netProfit, cls: netProfit >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50' },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl p-3.5 ${item.cls}`}>
                  <p className="text-[11px] font-semibold opacity-70">{item.label}</p>
                  <p className="text-lg font-black tabular-nums mt-0.5">{egp(item.value)}</p>
                  {totalSales > 0 && i > 0 && <p className="text-[10px] font-semibold mt-0.5 opacity-60">{pct(Math.abs(item.value), totalSales)}% من الإيرادات</p>}
                </div>
              ))}
            </div>
          </div>

          {/* ─── Charts Row 1: Sales Trend + Revenue Split ─── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2">
              <SalesTrendChart labels={chartLabels} sales={chartSales} expenses={chartExpenses} title={days === 1 ? 'مبيعات اليوم (بالساعة)' : `المبيعات والمصروفات — ${label}`} />
            </div>
            <RevenueBreakdownChart cash={cashSales} credit={creditSales} ka={kaSales} />
          </div>

          {/* ─── حجم الفلوس بالوسيلة + أرصدة الخزائن ─── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <PaymentMethodsPie cash={payCash} insta={payInsta} wallet={payWallet} network={payNetwork} />
            <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-bold text-[#1a1a2e]">أرصدة الخزائن دلوقتي</h3>
                <Link href="/treasury" className="text-xs font-semibold text-[#0f3460] hover:underline">إدارة الخزائن ←</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'إجمالي الخزائن', value: treasuryTotal, cls: 'text-[#0f3460] bg-blue-50' },
                  { label: 'الخزنة العمومية', value: mainTreasury, cls: 'text-emerald-700 bg-emerald-50' },
                  { label: 'تحت التسوية (إنستا/محفظة)', value: clearingTreasury, cls: 'text-purple-700 bg-purple-50' },
                  { label: 'بالبنك', value: bankTreasury, cls: 'text-teal-700 bg-teal-50' },
                ].map((t) => (
                  <div key={t.label} className={`rounded-xl p-3.5 ${t.cls}`}>
                    <p className="text-[11px] font-semibold opacity-70">{t.label}</p>
                    <p className="text-lg font-black tabular-nums mt-0.5">{egp(t.value)}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                {treasuries.filter((t: any) => t.type === 'SALESMAN_CASH' && Number(t.balance) > 0).slice(0, 3).map((t: any) => (
                  <div key={t.name} className="rounded-xl p-3 bg-amber-50 text-amber-800">
                    <p className="text-[10px] font-semibold opacity-70 truncate">{t.name}</p>
                    <p className="text-sm font-black tabular-nums">{egp(Number(t.balance))}</p>
                  </div>
                ))}
                {pendingUnloadsCount > 0 && (
                  <Link href="/warehouse" className="rounded-xl p-3 bg-orange-50 text-orange-700 hover:ring-2 ring-orange-200 transition-all">
                    <p className="text-[10px] font-semibold opacity-70">أوامر تفريغ منتظرة استلام المخزن</p>
                    <p className="text-sm font-black tabular-nums">{fmt(pendingUnloadsCount)} أمر</p>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ─── Charts Row 2: Top Products + Expenses by Category ─── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <TopProductsBar items={topProducts} />
            <ExpensesByCategoryChart items={expensesByCategory} />
          </div>

          {/* ─── Charts Row 3: Production + Cash Flow ─── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ProductionTrendChart labels={chartLabels} produced={chartProdQty} orders={chartProdOrders} />
            <CashFlowChart labels={chartLabels} inflows={chartCfIn} outflows={chartCfOut} />
          </div>

          {/* ─── أحدث الفواتير (جدول تفصيلي) ─── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3">
              <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2"><ReceiptText className="w-4 h-4 text-[#0f3460]" /> أحدث الفواتير</h3>
              <Link href="/sales" className="text-[11px] text-[#0f3460] font-bold hover:underline">كل المبيعات ←</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50 text-xs">
                    <th className="p-3 font-medium">الفاتورة</th>
                    <th className="p-3 font-medium">العميل</th>
                    <th className="p-3 font-medium">النوع</th>
                    <th className="p-3 font-medium">الوسيلة</th>
                    <th className="p-3 font-medium">الصافي</th>
                    <th className="p-3 font-medium">الوقت</th>
                    <th className="p-3 font-medium no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(-8).reverse().map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="p-3 font-semibold tabular-nums text-xs">{inv.invoiceNo}</td>
                      <td className="p-3">{inv.customer?.name || '—'}</td>
                      <td className="p-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${inv.type === 'CASH' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {inv.type === 'CASH' ? 'نقدي' : 'آجل'}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-500">{inv.paymentMethod}{(inv as any).collectionMethod === 'تحويل انستا' ? ' — إنستا' : (inv as any).collectionMethod === 'تحويل محفظة' ? ' — محفظة' : ''}</td>
                      <td className="p-3 font-bold tabular-nums">{egp(Number(inv.netAmount))}</td>
                      <td className="p-3 text-xs text-gray-400 tabular-nums">{new Date(inv.createdAt).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-3 no-print">
                        <Link href={`/print/invoice/${inv.id}`} className="text-[#0f3460] hover:underline"><Printer className="w-3.5 h-3.5" /></Link>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-sm">مفيش فواتير في الفترة دي.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Bottom: Receivables + Low Stock + Activity ─── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* ملخص التحصيل والذمم */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#1a1a2e] mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" />التحصيل والذمم</h3>
              <div className="space-y-3">
                {[
                  { label: 'تحصيلات ديون عملاء', value: collectionsTotal, cls: 'text-green-600' },
                  { label: 'مدفوعات الموردين', value: supPayTotal, cls: 'text-red-600' },
                  { label: 'كبار الموردين — مدفوع', value: kaPayTotal, cls: 'text-blue-600' },
                  { label: 'كبار الموردين — مستحق', value: keyClaimsTotal, cls: 'text-amber-600' },
                  { label: 'مناديب نشطين', value: activeDelegates, cls: 'text-sky-600', isFmt: true },
                  { label: 'عملاء نشطين', value: customerCount, cls: 'text-purple-600', isFmt: true },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2">
                    <span className="text-gray-600">{r.label}</span>
                    <span className={`font-bold tabular-nums ${r.cls}`}>{(r as any).isFmt ? fmt(r.value) : egp(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* أصناف تحت الحد */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#1a1a2e]">أصناف تحت الحد الأدنى</h3>
                <Link href="/warehouse" className="text-[11px] text-[#0f3460] font-bold hover:underline">المخزن ←</Link>
              </div>
              <div className="space-y-2.5">
                {lowStockProducts.length === 0 && <p className="text-sm text-gray-400">كل الأصناف فوق الحد ✓</p>}
                {lowStockProducts.slice(0, 7).map(p => (
                  <div key={p.id} className="flex justify-between items-center text-sm pb-2 border-b border-gray-50 last:border-0">
                    <span className="text-gray-700 text-xs">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full ${Number(p.quantity) === 0 ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (Number(p.quantity) / Math.max(Number(p.minStock), 1)) * 100)}%` }} />
                      </div>
                      <span className="font-bold text-red-600 tabular-nums text-xs whitespace-nowrap">{Number(p.quantity)}/{Number(p.minStock)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <RecentActivity activities={recentActivity} />
          </div>
        </>
      )}

      {!showOps && perms.includes('keyaccounts') && (
        <Link href="/key-accounts" className="group flex items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-100 hover:ring-[#0f3460]/30 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#0f3460] text-white flex items-center justify-center shrink-0"><Building2 className="w-6 h-6" /></div>
            <div>
              <p className="font-bold text-[#1a1a2e]">إدارة كبار الموردين</p>
              <p className="text-sm text-gray-500 mt-0.5">{keyClaimsTotal > 0 ? `مطالبات مستحقة ${egp(keyClaimsTotal)}` : 'الحسابات والفروع والتحصيل'}</p>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:-translate-x-1 transition-transform" />
        </Link>
      )}
    </div>
  )
}

/* ─── KPI Card Component ─── */
function KpiCard({ label, value, sub, Icon, color, href, trend, delta, deltaInverted }: {
  label: string; value: string; sub: string; Icon: any; color: string; href: string; trend: 'up' | 'down' | null
  delta?: number | null // نسبة التغيّر عن الفترة السابقة
  deltaInverted?: boolean // للمصروفات: الزيادة وحشة
}) {
  const deltaGood = delta !== null && delta !== undefined ? (deltaInverted ? delta <= 0 : delta >= 0) : null
  return (
    <Link href={href} className="group bg-white p-4 rounded-2xl shadow-sm ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-gray-200">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {delta !== null && delta !== undefined ? (
          <span
            title="مقارنة بالفترة السابقة بنفس الطول"
            className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${deltaGood ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
          >
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta) >= 1000 ? '+999%' : `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`}
          </span>
        ) : trend ? (
          <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          </span>
        ) : null}
      </div>
      <p className="text-lg font-black text-[#1a1a2e] tabular-nums mt-2 truncate">{value}</p>
      <p className="text-[11px] text-gray-500 flex items-center justify-between mt-0.5">
        <span>{label}</span>
        <span className="text-gray-400 tabular-nums">{sub}</span>
      </p>
    </Link>
  )
}

/* ─── Mini KPI ─── */
function MiniKpi({ label, value, Icon, cls }: { label: string; value: string; Icon: any; cls: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gray-50 ${cls}`}><Icon className="w-4 h-4" /></div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 truncate">{label}</p>
        <p className="text-sm font-bold tabular-nums text-[#1a1a2e] truncate">{value}</p>
      </div>
    </div>
  )
}

/* ═══════════════ لوحة تحكم المندوب ═══════════════ */
async function DelegateDashboard({ userId, userName, days, from, to, searchParams }: {
  userId: string; userName: string; days: number; from: Date; to: Date; searchParams: { days?: string; from?: string; to?: string }
}) {
  const period = { gte: from, lte: to }

  const delegate = await prisma.delegate.findFirst({ where: { userId }, include: { vehicle: true } })
  if (!delegate) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
          <Truck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">الحساب ده مش مربوط بمندوب — كلّم الإدارة.</p>
        </div>
      </div>
    )
  }

  const periodInv = { delegateId: delegate.id, createdAt: period }
  const [invAgg, topByCustomer, bonusAgg, tours, distinctCust, settleAgg, activeTour] = await Promise.all([
    prisma.invoice.aggregate({ where: periodInv, _sum: { netAmount: true, paidAmount: true }, _count: true }),
    prisma.invoice.groupBy({ by: ['customerId'], where: periodInv, _sum: { netAmount: true }, _count: true, orderBy: { _sum: { netAmount: 'desc' } }, take: 5 }),
    prisma.invoiceItem.aggregate({ where: { isBonus: true, invoice: periodInv }, _sum: { quantity: true } }),
    prisma.deliveryOrder.count({ where: { delegateId: delegate.id, createdAt: period } }),
    prisma.invoice.findMany({ where: periodInv, distinct: ['customerId'], select: { customerId: true } }),
    prisma.settlement.aggregate({ where: { delegateId: delegate.id, createdAt: period }, _sum: { commission: true, returnedQty: true } }),
    prisma.deliveryOrder.findFirst({ where: { delegateId: delegate.id, status: 'IN_PROGRESS' }, select: { id: true, orderNo: true } }),
  ])

  const topCustNames = topByCustomer.length
    ? await prisma.customer.findMany({ where: { id: { in: topByCustomer.map(t => t.customerId) } }, select: { id: true, name: true, area: true } })
    : []
  const custById = new Map(topCustNames.map(c => [c.id, c]))
  const topCustomers = topByCustomer.map(t => ({
    name: custById.get(t.customerId)?.name || 'عميل',
    area: custById.get(t.customerId)?.area || '',
    total: Number(t._sum.netAmount) || 0,
    count: t._count,
  }))

  const totalSales = Number(invAgg._sum.netAmount) || 0
  const cash = Number(invAgg._sum.paidAmount) || 0
  const credit = Math.max(0, totalSales - cash)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور'

  const kpis = [
    { label: 'مبيعاتي', value: egp(totalSales), Icon: ShoppingCart, cls: 'bg-blue-50 text-blue-700' },
    { label: 'محصّل نقدي', value: egp(cash), Icon: Wallet, cls: 'bg-green-50 text-green-700' },
    { label: 'آجل مستحق', value: egp(credit), Icon: Clock, cls: 'bg-amber-50 text-amber-700' },
    { label: 'عمولتي', value: egp(Number(settleAgg._sum.commission) || 0), Icon: Coins, cls: 'bg-purple-50 text-purple-700' },
    { label: 'عملائي', value: `${distinctCust.length}`, Icon: Users, cls: 'bg-sky-50 text-sky-700' },
    { label: 'عدد الفواتير', value: `${invAgg._count || 0}`, Icon: ClipboardList, cls: 'bg-indigo-50 text-indigo-700' },
    { label: 'جولاتي', value: `${tours}`, Icon: Truck, cls: 'bg-teal-50 text-teal-700' },
    { label: 'هدايا وزّعتها', value: `${Number(bonusAgg._sum.quantity) || 0}`, Icon: Gift, cls: 'bg-rose-50 text-rose-700' },
    { label: 'مرتجعات', value: `${Number(settleAgg._sum.returnedQty) || 0}`, Icon: Undo2, cls: 'bg-orange-50 text-orange-700' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="relative overflow-hidden rounded-3xl text-white p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 60%, #16213e 100%)' }}>
        <div className="absolute -left-10 -bottom-16 opacity-[0.05] pointer-events-none"><AlBadrLogo className="w-72 h-72" /></div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">{greeting}، {userName.split(' ')[0]}</h1>
            <p className="text-white/50 text-sm mt-1">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <div className="flex flex-wrap gap-2 mt-4 text-xs font-bold">
              {delegate.vehicle && <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg tabular-nums"><Car className="w-4 h-4 text-[#e9b44c]" /> {delegate.vehicle.plateNo}</span>}
              {(delegate.route || delegate.area) && <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg"><MapPin className="w-4 h-4 text-[#e9b44c]" /> {delegate.route || delegate.area}</span>}
              {activeTour && <span className="flex items-center gap-1.5 bg-green-500/20 text-green-300 px-3 py-1.5 rounded-lg tabular-nums"><Truck className="w-4 h-4" /> جولة شغالة: {activeTour.orderNo}</span>}
            </div>
          </div>
          <PeriodSelector current={days} basePath="/dashboard" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.cls}`}><s.Icon className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{s.label}</p>
              <p className="text-base font-bold tabular-nums text-[#1a1a2e] truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2 p-5 pb-3"><Crown className="w-5 h-5 text-[#e9b44c]" /> أكتر العملاء شراءً</h3>
          {topCustomers.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-500">مفيش مبيعات في الفترة دي.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-[#e9b44c] text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{c.area || '—'} · {c.count} فاتورة</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#0f3460] shrink-0">{egp(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Link href="/drivers" className="group bg-gradient-to-br from-[#0f3460] to-[#16213e] text-white rounded-xl shadow-sm p-6 flex items-center justify-between hover:-translate-y-0.5 transition-all">
          <div>
            <p className="text-lg font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-[#e9b44c]" /> شاشة المناديب</p>
            <p className="text-white/60 text-sm mt-1">تحميل · تسليم عملاء · مرتجعات · تسوية</p>
          </div>
          <ChevronLeft className="w-6 h-6 text-white/60 group-hover:-translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  )
}
