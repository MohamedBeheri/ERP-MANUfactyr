import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Truck, Users, Printer, ChevronLeft, TrendingUp } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeliveryOrderForm } from '@/components/delivery-order-form'
import { DelegateManager } from '@/components/delegate-manager'
import { ExportButtons } from '@/components/export-buttons'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'معلّقة',
  IN_PROGRESS: 'شغالة',
  COMPLETED: 'اتسوّت',
  CANCELLED: 'ملغية',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-orange-50 text-orange-600',
  COMPLETED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-red-50 text-red-600',
}

export default async function DelegatesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [delegates, products, deliveryOrders, warehouses, vehicles, delegateUsers] = await Promise.all([
    prisma.delegate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: true,
        user: { select: { id: true, name: true, username: true } },
        deliveryOrders: { select: { id: true, status: true, createdAt: true } },
        settlements: { select: { cashAmount: true, creditAmount: true, soldQty: true, returnedQty: true } },
      },
    }),
    prisma.product.findMany({ where: { isActive: true, type: 'FINISHED' }, orderBy: { name: 'asc' } }),
    prisma.deliveryOrder.findMany({
      include: { delegate: true, items: true, settlement: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { delegates: { where: { isActive: true }, select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE', role: { in: ['DELEGATE', 'SALES'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, username: true },
    }),
  ])

  // قياس أداء المناديب
  const performance = delegates.map((d) => {
    const tours = d.deliveryOrders.length
    const activeTours = d.deliveryOrders.filter((o) => o.status === 'IN_PROGRESS').length
    const soldQty = d.settlements.reduce((s, st) => s + st.soldQty, 0)
    const returnedQty = d.settlements.reduce((s, st) => s + st.returnedQty, 0)
    const cash = d.settlements.reduce((s, st) => s + Number(st.cashAmount), 0)
    const credit = d.settlements.reduce((s, st) => s + Number(st.creditAmount), 0)
    const returnRate = soldQty + returnedQty > 0 ? (returnedQty / (soldQty + returnedQty)) * 100 : 0
    const lastTour = d.deliveryOrders.length
      ? new Date(Math.max(...d.deliveryOrders.map((o) => new Date(o.createdAt).getTime())))
      : null
    return { d, tours, activeTours, soldQty, returnedQty, cash, credit, returnRate, lastTour }
  })

  const perfRows = performance.map((p) => [
    p.d.name,
    p.d.vehicle?.plateNo || p.d.carNumber || '—',
    p.d.route || '—',
    p.tours,
    p.soldQty,
    p.returnedQty,
    `${p.returnRate.toFixed(1)}%`,
    p.cash.toFixed(2),
    p.credit.toFixed(2),
    Number(p.d.commissionDue).toFixed(2),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">المندوبين وجولات التوزيع</h1>
        <p className="text-sm text-gray-500 mt-0.5">حمّل العربية ← سلّم للعملاء في الطريق ← سوّي الجولة آخر اليوم</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* الجولات */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Truck className="w-5 h-5 text-[#e94560]" />
            <h3 className="text-base font-bold text-[#1a1a2e]">جولات التوزيع</h3>
            <span className="text-xs text-gray-400">({deliveryOrders.length})</span>
          </div>
          <div className="divide-y divide-gray-50">
            {deliveryOrders.length === 0 && (
              <p className="p-6 text-sm text-gray-500">مفيش جولات لسه — ابدأ بتحميل عربية من الفورم الجنبي.</p>
            )}
            {deliveryOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-2 p-4 hover:bg-gray-50/60 transition-colors">
                <Link href={`/delegates/${order.id}`} className="flex-1 flex items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#1a1a2e] tabular-nums truncate">{order.orderNo}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {order.delegate.name} · {order.items.length} صنف ·{' '}
                      {new Date(order.createdAt).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${STATUS_COLOR[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </Link>
                <Link
                  href={`/print/delivery/${order.id}`}
                  className="shrink-0 p-2 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg"
                  title="طباعة أمر التحميل"
                  aria-label="طباعة أمر التحميل"
                >
                  <Printer className="w-4 h-4" />
                </Link>
                <Link
                  href={`/delegates/${order.id}`}
                  className="shrink-0 p-2 text-gray-400 hover:text-[#e94560] hover:bg-gray-100 rounded-lg"
                  aria-label="تفاصيل الجولة"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* فورم التحميل */}
        <div className="space-y-4">
          <DeliveryOrderForm delegates={delegates} products={products} warehouses={warehouses} />
        </div>
      </div>

      {/* قياس الأداء */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden print-area">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-base font-bold text-[#1a1a2e]">قياس أداء المناديب</h3>
          </div>
          <ExportButtons
            fileName="أداء-المناديب"
            headers={['المندوب', 'العربية', 'خط السير', 'الجولات', 'المباع', 'المرتجع', 'نسبة المرتجع', 'نقدي', 'آجل', 'عمولة مستحقة']}
            rows={perfRows}
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
                <th className="p-3 font-medium">المباع</th>
                <th className="p-3 font-medium">نسبة المرتجع</th>
                <th className="p-3 font-medium">محصّل نقدي</th>
                <th className="p-3 font-medium">آجل</th>
                <th className="p-3 font-medium">آخر جولة</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(({ d, tours, activeTours, soldQty, returnRate, cash, credit, lastTour }) => (
                <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold">
                    {d.name}
                    {activeTours > 0 && (
                      <span className="mr-2 text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-semibold">
                        في الطريق
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500 tabular-nums">{d.vehicle?.plateNo || d.carNumber || '—'}</td>
                  <td className="p-3 text-gray-500">{d.route || '—'}</td>
                  <td className="p-3 tabular-nums">{tours}</td>
                  <td className="p-3 tabular-nums font-semibold">{soldQty}</td>
                  <td className="p-3">
                    <span className={`tabular-nums font-semibold ${returnRate > 30 ? 'text-red-600' : returnRate > 15 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {returnRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 tabular-nums text-green-700">{cash.toLocaleString('ar-EG')} ج.م</td>
                  <td className="p-3 tabular-nums text-yellow-700">{credit.toLocaleString('ar-EG')} ج.م</td>
                  <td className="p-3 text-gray-400 text-xs tabular-nums">
                    {lastTour ? lastTour.toLocaleDateString('ar-EG') : '—'}
                  </td>
                </tr>
              ))}
              {performance.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-gray-500">مفيش مناديب لسه.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* إدارة الأسطول: المناديب والعربيات */}
      <div className="no-print">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-[#0f3460]" />
          <h2 className="text-base font-bold text-[#1a1a2e]">إدارة الأسطول (المناديب والعربيات)</h2>
        </div>
        <DelegateManager
          delegates={delegates.map((d) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            carNumber: d.carNumber,
            area: d.area,
            route: d.route,
            commissionRate: Number(d.commissionRate),
            totalSales: Number(d.totalSales),
            commissionDue: Number(d.commissionDue),
            vehicleId: d.vehicleId,
            vehiclePlate: d.vehicle?.plateNo || null,
            userId: d.userId,
            userName: d.user?.name || null,
          }))}
          vehicles={vehicles.map((v) => ({
            id: v.id,
            plateNo: v.plateNo,
            model: v.model,
            capacity: v.capacity,
            notes: v.notes,
            delegateNames: v.delegates.map((x) => x.name),
          }))}
          users={delegateUsers}
        />
      </div>
    </div>
  )
}
