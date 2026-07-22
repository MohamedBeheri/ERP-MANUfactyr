import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingCart,
  Factory,
  Truck,
  PackageOpen,
  AlertTriangle,
  ChevronLeft,
  Globe,
  Warehouse,
  Building2,
  Wallet,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions } from '@/lib/permissions'
import { DashboardStats } from '@/components/dashboard-stats'
import { RecentActivity } from '@/components/recent-activity'
import { SalesChart } from '@/components/sales-chart'
import { TopProductsChart, PaymentSplitChart } from '@/components/top-products-chart'
import { PeriodSelector } from '@/components/period-selector'
import { AlBadrLogo } from '@/components/albadr-logo'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: { days?: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  // مدة العرض: من يوم واحد لحد 30 يوم
  const days = Math.min(30, Math.max(1, Number(searchParams.days) || 7))
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  from.setHours(0, 0, 0, 0)

  const [invoices, productions, purchases, allProducts, activeDelegates, recentActivity, pendingOnline, activeTours, keyClaims] =
    await Promise.all([
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
      prisma.onlineOrder.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.deliveryOrder.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.keyAccount.aggregate({ where: { isActive: true }, _sum: { balance: true } }).catch(() => ({ _sum: { balance: 0 } })),
    ])

  // صلاحيات المستخدم — الداشبورد بيعرض بس الأقسام اللي من حقه
  const perms = effectivePermissions((session.user as any).role, (session.user as any).permissions)
  const keyClaimsTotal = Number(keyClaims._sum.balance) || 0

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

  // الإحصائيات والرسوم التشغيلية تظهر بس لمن له صلاحية تشغيلية
  const showOps = perms.some((p) => ['sales', 'finance', 'warehouse', 'factory', 'delegates'].includes(p))
  const periodTitle = days === 1 ? 'مبيعات اليوم (بالساعة)' : `المبيعات آخر ${days} يوم`
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور'
  const firstName = (session.user.name || '').split(' ')[0]

  const alerts = [
    pendingOnline > 0 && perms.includes('store') && {
      href: '/online-orders',
      Icon: Globe,
      text: `${pendingOnline} طلب جديد من الموقع مستني تأكيدك`,
      cls: 'bg-purple-50 text-purple-700 ring-purple-100 hover:ring-purple-300',
    },
    activeTours > 0 && perms.includes('delegates') && {
      href: '/drivers',
      Icon: Truck,
      text: `${activeTours} عربية في الطريق دلوقتي`,
      cls: 'bg-sky-50 text-sky-700 ring-sky-100 hover:ring-sky-300',
    },
    keyClaimsTotal > 0 && perms.includes('keyaccounts') && {
      href: '/key-accounts',
      Icon: Wallet,
      text: `مطالبات كبار الموردين المستحقة ${keyClaimsTotal.toLocaleString('ar-EG')} ج.م`,
      cls: 'bg-amber-50 text-amber-700 ring-amber-100 hover:ring-amber-300',
    },
    lowStockProducts.length > 0 && perms.includes('warehouse') && {
      href: '/warehouse',
      Icon: AlertTriangle,
      text: `${lowStockProducts.length} صنف وصل تحت الحد الأدنى`,
      cls: 'bg-red-50 text-red-700 ring-red-100 hover:ring-red-300',
    },
  ].filter(Boolean) as { href: string; Icon: any; text: string; cls: string }[]

  const quickActions = [
    { href: '/sales', label: 'بيع جديد', Icon: ShoppingCart, perm: 'sales' },
    { href: '/factory', label: 'أمر تصنيع', Icon: Factory, perm: 'factory' },
    { href: '/delegates', label: 'تحميل عربية', Icon: Truck, perm: 'delegates' },
    { href: '/key-accounts', label: 'كبار الموردين', Icon: Building2, perm: 'keyaccounts' },
    { href: '/online-orders', label: 'طلبات الموقع', Icon: PackageOpen, perm: 'store' },
    { href: '/warehouse', label: 'جرد المخزن', Icon: Warehouse, perm: 'warehouse' },
  ].filter((a) => perms.includes(a.perm))

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* بانر الترحيب */}
      <div
        className="relative overflow-hidden rounded-3xl text-white p-6 sm:p-8"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 60%, #16213e 100%)',
        }}
      >
        <div className="absolute -left-10 -bottom-16 opacity-[0.07] pointer-events-none">
          <AlBadrLogo className="w-72 h-72" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">
              {greeting}{firstName ? `، ${firstName}` : ''} 👋
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}شركة البدر لتجارة البن
            </p>
            {/* إجراءات سريعة */}
            <div className="flex flex-wrap gap-2 mt-5">
              {quickActions.map(({ href, label, Icon }) => (
                <Link
                  key={href + label}
                  href={href}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-[#e9b44c] hover:text-[#1a1a2e] text-sm font-bold transition-all duration-200 backdrop-blur"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <PeriodSelector current={days} basePath="/dashboard" />
        </div>
      </div>

      {/* تنبيهات تحتاج تصرف */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {alerts.map(({ href, Icon, text, cls }) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-center justify-between gap-3 p-4 rounded-2xl ring-1 transition-all duration-200 hover:-translate-y-0.5 ${cls}`}
            >
              <span className="flex items-center gap-2.5 text-sm font-bold">
                <Icon className="w-5 h-5 shrink-0" />
                {text}
              </span>
              <ChevronLeft className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-1" />
            </Link>
          ))}
        </div>
      )}

      {showOps ? (
        <>
          <DashboardStats data={kpi} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <SalesChart labels={labels} values={values} title={periodTitle} />
            </div>
            <PaymentSplitChart cash={cashAmount} credit={creditAmount} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <TopProductsChart labels={topProducts.map((p) => p.name)} values={topProducts.map((p) => p.qty)} />

            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1a1a2e]">أصناف تحت الحد الأدنى</h3>
                <Link href="/warehouse" className="text-xs text-[#0f3460] font-bold hover:underline">
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
        </>
      ) : perms.includes('keyaccounts') ? (
        <Link
          href="/key-accounts"
          className="group flex items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-100 hover:ring-[#0f3460]/30 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#0f3460] text-white flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-[#1a1a2e]">إدارة كبار الموردين</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {keyClaimsTotal > 0 ? `مطالبات مستحقة ${keyClaimsTotal.toLocaleString('ar-EG')} ج.م` : 'الحسابات والفروع وبيانات الأسعار والتحصيل'}
              </p>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 text-gray-400 transition-transform group-hover:-translate-x-1" />
        </Link>
      ) : null}
    </div>
  )
}
