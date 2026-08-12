import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { ShoppingCart, Users, Truck, ReceiptText, Banknote, Clock, UserPlus, TrendingUp } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, hasSectionAccess } from '@/lib/permissions'
import { PeriodSelector } from '@/components/period-selector'
import { SalesTrendChart, PaymentMethodsPie, TopProductsBar } from '@/components/dashboard-charts'
import { GroupBarChart } from '@/components/group-charts'

export const dynamic = 'force-dynamic'

const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })

function buildPeriod(sp: { days?: string; from?: string; to?: string }) {
  if (sp.from && sp.to) {
    const from = new Date(sp.from); from.setHours(0, 0, 0, 0)
    const to = new Date(sp.to); to.setHours(23, 59, 59, 999)
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
    return { from, to, days }
  }
  const days = Math.min(90, Math.max(1, Number(sp.days) || 7))
  const from = new Date(); from.setDate(from.getDate() - (days - 1)); from.setHours(0, 0, 0, 0)
  const to = new Date(); to.setHours(23, 59, 59, 999)
  return { from, to, days }
}

// لوحة تحكم البيع والتوزيع: مبيعات + مناديب + عملاء برسومات وفلتر فترة
export default async function SalesDashboardPage({ searchParams: raw }: { searchParams: Promise<{ days?: string; from?: string; to?: string }> }) {
  const sp = await raw
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!hasSectionAccess(perms, 'sales') && !hasSectionAccess(perms, 'delegates') && !hasSectionAccess(perms, 'customers')) redirect('/dashboard')

  const { from, to, days } = buildPeriod(sp)
  const period = { gte: from, lte: to }

  const [invoices, delegates, newCustomers, totalCustomers] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: period, status: 'COMPLETED' },
      include: { items: { include: { product: { select: { name: true } } } }, delegate: { select: { name: true } }, customer: { select: { name: true } } },
    }),
    prisma.delegate.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.customer.count({ where: { createdAt: period } }),
    prisma.customer.count({ where: { isActive: true } }),
  ])

  // KPIs
  const totalSales = invoices.reduce((s, i) => s + Number(i.netAmount), 0)
  const cashCollected = invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
  const creditOutstanding = invoices.reduce((s, i) => s + (Number(i.netAmount) - Number(i.paidAmount)), 0)
  const invoiceCount = invoices.length
  const avgInvoice = invoiceCount > 0 ? totalSales / invoiceCount : 0

  // خط المبيعات اليومي
  const dayKey = (d: Date) => d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
  const dayLabels: string[] = []
  const salesByDay: number[] = []
  const cursor = new Date(from)
  for (let i = 0; i < days; i++) {
    const label = dayKey(cursor)
    dayLabels.push(label)
    const dayStart = new Date(cursor); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(cursor); dayEnd.setHours(23, 59, 59, 999)
    salesByDay.push(invoices.filter((iv) => iv.createdAt >= dayStart && iv.createdAt <= dayEnd).reduce((s, iv) => s + Number(iv.netAmount), 0))
    cursor.setDate(cursor.getDate() + 1)
  }

  // التحصيل بالوسيلة
  let cash = 0, insta = 0, wallet = 0
  for (const iv of invoices) {
    const paid = Number(iv.paidAmount)
    if (paid <= 0) continue
    if (iv.collectionMethod === 'تحويل انستا') insta += paid
    else if (iv.collectionMethod === 'تحويل محفظة') wallet += paid
    else cash += paid
  }

  // أفضل المنتجات
  const prodMap = new Map<string, { qty: number; revenue: number }>()
  for (const iv of invoices) for (const it of iv.items) {
    const prev = prodMap.get(it.product.name) || { qty: 0, revenue: 0 }
    prev.qty += Number(it.quantity); prev.revenue += Number(it.totalPrice)
    prodMap.set(it.product.name, prev)
  }
  const topProducts = Array.from(prodMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  // أداء المناديب (مبيعات لكل مندوب في الفترة)
  const delMap = new Map<string, number>()
  for (const iv of invoices) {
    if (!iv.delegate) continue
    delMap.set(iv.delegate.name, (delMap.get(iv.delegate.name) || 0) + Number(iv.netAmount))
  }
  const delegatePerf = Array.from(delMap.entries()).map(([name, v]) => ({ label: name, value: v })).sort((a, b) => b.value - a.value)

  // أفضل العملاء
  const custMap = new Map<string, number>()
  for (const iv of invoices) custMap.set(iv.customer.name, (custMap.get(iv.customer.name) || 0) + Number(iv.netAmount))
  const topCustomers = Array.from(custMap.entries()).map(([name, v]) => ({ label: name, value: v })).sort((a, b) => b.value - a.value).slice(0, 8)

  const activeDelegates = delMap.size

  const kpis = [
    { label: 'إجمالي المبيعات', value: egp(totalSales), Icon: ShoppingCart, cls: 'text-[#0f3460]', bg: 'bg-blue-50' },
    { label: 'عدد الفواتير', value: fmt(invoiceCount), Icon: ReceiptText, cls: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'متوسط الفاتورة', value: egp(avgInvoice), Icon: TrendingUp, cls: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'محصّل نقدي/فوري', value: egp(cashCollected), Icon: Banknote, cls: 'text-green-700', bg: 'bg-green-50' },
    { label: 'آجل على العملاء', value: egp(creditOutstanding), Icon: Clock, cls: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'مناديب نشطين', value: fmt(activeDelegates), Icon: Truck, cls: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'عملاء جدد بالفترة', value: fmt(newCustomers), Icon: UserPlus, cls: 'text-purple-700', bg: 'bg-purple-50' },
    { label: 'إجمالي العملاء', value: fmt(totalCustomers), Icon: Users, cls: 'text-sky-700', bg: 'bg-sky-50' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">لوحة تحكم البيع والتوزيع</h1>
          <p className="text-sm text-gray-500 mt-0.5">متابعة المبيعات والمناديب والعملاء برسومات وفلتر فترة</p>
        </div>
        <PeriodSelector current={sp.from && sp.to ? 0 : days} basePath="/sales/dashboard" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}><k.Icon className={`w-5 h-5 ${k.cls}`} /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500">{k.label}</p>
              <p className={`text-base font-bold tabular-nums ${k.cls}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><SalesTrendChart labels={dayLabels} sales={salesByDay} expenses={salesByDay.map(() => 0)} title="اتجاه المبيعات اليومي" /></div>
        <PaymentMethodsPie cash={cash} insta={insta} wallet={wallet} network={0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GroupBarChart title="أداء المناديب" subtitle="إجمالي مبيعات كل مندوب في الفترة" items={delegatePerf} color="#f59e0b" emptyText="مفيش مبيعات مناديب في الفترة" />
        <GroupBarChart title="أفضل العملاء" subtitle="أعلى العملاء شراءً في الفترة" items={topCustomers} color="#8b5cf6" emptyText="مفيش مبيعات في الفترة" />
      </div>

      <TopProductsBar items={topProducts} />
    </div>
  )
}
