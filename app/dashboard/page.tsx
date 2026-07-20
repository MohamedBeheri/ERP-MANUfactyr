import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardStats } from '@/components/dashboard-stats'
import { RecentActivity } from '@/components/recent-activity'
import { SalesChart } from '@/components/sales-chart'
import { TopProductsChart, PaymentSplitChart } from '@/components/top-products-chart'
import { PeriodSelector } from '@/components/period-selector'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: { days?: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  // مدة العرض: من يوم واحد لحد 30 يوم
  const days = Math.min(30, Math.max(1, Number(searchParams.days) || 7))
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  from.setHours(0, 0, 0, 0)

  const [invoices, productions, purchases, allProducts, activeDelegates, recentActivity] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: { gte: from }, status: 'COMPLETED' },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.production.findMany({
      where: { createdAt: { gte: from } },
      include: { items: true },
    }),
    prisma.purchase.aggregate({
      where: { createdAt: { gte: from } },
      _sum: { totalAmount: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, quantity: true, minStock: true, unit: true },
    }),
    prisma.delegate.count({ where: { isActive: true } }),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    }),
  ])

  // KPIs
  const periodSales = invoices.reduce((s, i) => s + Number(i.netAmount), 0)
  const cashAmount = invoices.filter((i) => i.type === 'CASH').reduce((s, i) => s + Number(i.netAmount), 0)
  const creditAmount = invoices.filter((i) => i.type === 'CREDIT').reduce((s, i) => s + Number(i.netAmount), 0)
  const producedQty = productions.reduce((s, p) => s + p.items.reduce((a, i) => a + i.quantity, 0), 0)
  const lowStockProducts = allProducts.filter((p) => p.quantity <= p.minStock)

  // تجميع المبيعات: بالساعة لو يوم واحد، باليوم غير كده
  let labels: string[] = []
  let values: number[] = []
  if (days === 1) {
    const buckets = new Array(24).fill(0)
    for (const inv of invoices) {
      buckets[new Date(inv.createdAt).getHours()] += Number(inv.netAmount)
    }
    labels = buckets.map((_, h) => `${h}:00`)
    values = buckets
  } else {
    const dayKeys: string[] = []
    const map = new Map<string, number>()
    for (let i = 0; i < days; i++) {
      const d = new Date(from)
      d.setDate(from.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      dayKeys.push(key)
      map.set(key, 0)
    }
    for (const inv of invoices) {
      const key = new Date(inv.createdAt).toISOString().slice(0, 10)
      if (map.has(key)) map.set(key, (map.get(key) || 0) + Number(inv.netAmount))
    }
    labels = dayKeys.map((k) => new Date(k).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }))
    values = dayKeys.map((k) => map.get(k) || 0)
  }

  // الأكثر مبيعًا في الفترة
  const productSales = new Map<string, { name: string; qty: number }>()
  for (const inv of invoices) {
    for (const item of inv.items) {
      const prev = productSales.get(item.productId)
      productSales.set(item.productId, {
        name: item.product.name,
        qty: (prev?.qty || 0) + item.quantity,
      })
    }
  }
  const topProducts = Array.from(productSales.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)

  const kpi = {
    periodSales,
    invoiceCount: invoices.length,
    producedQty,
    purchasesAmount: Number(purchases._sum.totalAmount) || 0,
    lowStock: lowStockProducts.length,
    activeDelegates,
    cashAmount,
    creditAmount,
  }

  const periodTitle =
    days === 1 ? 'مبيعات اليوم (بالساعة)' : `المبيعات آخر ${days} يوم`

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">لوحة التحكم — شركة البدر لتجارة البن</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            نظرة شاملة على المصنع والمبيعات والمخازن والتوزيع ·{' '}
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <PeriodSelector current={days} basePath="/dashboard" />
      </div>

      <DashboardStats data={kpi} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <SalesChart labels={labels} values={values} title={periodTitle} />
        </div>
        <PaymentSplitChart cash={cashAmount} credit={creditAmount} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <TopProductsChart labels={topProducts.map((p) => p.name)} values={topProducts.map((p) => p.qty)} />

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#1a1a2e]">أصناف تحت الحد الأدنى</h3>
            <Link href="/warehouse" className="text-xs text-[#0f3460] font-medium hover:underline">
              المخزن ←
            </Link>
          </div>
          <div className="space-y-3">
            {lowStockProducts.length === 0 && (
              <p className="text-sm text-gray-500">كل الأصناف فوق الحد الأدنى ✓</p>
            )}
            {lowStockProducts.slice(0, 6).map((p) => (
              <div key={p.id} className="flex justify-between items-center text-sm pb-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">{p.name}</span>
                <span className="font-bold text-red-600 tabular-nums">
                  {p.quantity} / {p.minStock} {p.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        <RecentActivity activities={recentActivity} />
      </div>
    </div>
  )
}
