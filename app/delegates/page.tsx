import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Truck, Users, Printer, ChevronLeft } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeliveryOrderForm } from '@/components/delivery-order-form'
import { DelegateForm } from '@/components/delegate-form'

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

  const [delegates, products, deliveryOrders] = await Promise.all([
    prisma.delegate.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } }),
    prisma.product.findMany({ where: { isActive: true, type: 'FINISHED' }, orderBy: { name: 'asc' } }),
    prisma.deliveryOrder.findMany({
      include: { delegate: true, items: true, settlement: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">المندوبين وجولات التوزيع</h1>
        <p className="text-sm text-gray-500 mt-0.5">حمّل العربية → سلّم للعملاء في الطريق → سوّي الجولة آخر اليوم</p>
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
          <DeliveryOrderForm delegates={delegates} products={products} />
        </div>
      </div>

      {/* المناديب */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-[#0f3460]" />
          <h2 className="text-base font-bold text-[#1a1a2e]">المناديب ({delegates.length})</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {delegates.map((d) => (
            <div key={d.id} className="bg-white p-5 rounded-xl shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {d.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#1a1a2e] truncate">{d.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {d.carNumber || 'بدون عربية'} · {d.area || 'بدون منطقة'}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">إجمالي المبيعات</span>
                  <span className="font-semibold tabular-nums">{Number(d.totalSales).toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">عمولة مستحقة</span>
                  <span className="font-semibold text-[#e94560] tabular-nums">{Number(d.commissionDue).toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">نسبة العمولة</span>
                  <span className="font-semibold tabular-nums">{Number(d.commissionRate)}%</span>
                </div>
              </div>
            </div>
          ))}
          <DelegateForm />
        </div>
      </div>
    </div>
  )
}
