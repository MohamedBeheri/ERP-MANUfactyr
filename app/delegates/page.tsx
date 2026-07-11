import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeliveryOrderForm } from '@/components/delivery-order-form'
import { DelegateForm } from '@/components/delegate-form'

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
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.deliveryOrder.findMany({
      include: { delegate: true, items: true, settlement: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a2e]">🚚 المندوبين وجولات التوزيع</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-0">📋 الجولات</h3>
            <div className="divide-y divide-gray-100">
              {deliveryOrders.length === 0 && (
                <p className="p-6 text-sm text-gray-500">مفيش جولات لسه، ابدأ بتحميل عربية.</p>
              )}
              {deliveryOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/delegates/${order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-[#1a1a2e]">{order.orderNo}</p>
                    <p className="text-sm text-gray-500">
                      {order.delegate.name} · {order.items.length} صنف
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <DeliveryOrderForm delegates={delegates} products={products} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-[#1a1a2e] mb-3">👥 المناديب</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {delegates.map((d) => (
            <div key={d.id} className="bg-white p-5 rounded-xl shadow-sm">
              <p className="font-bold text-[#1a1a2e]">{d.name}</p>
              <p className="text-sm text-gray-500">{d.carNumber || '—'} · {d.area || '—'}</p>
              <div className="flex justify-between mt-3 text-sm">
                <span className="text-gray-500">إجمالي المبيعات</span>
                <span className="font-semibold">{Number(d.totalSales).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between mt-1 text-sm">
                <span className="text-gray-500">عمولة مستحقة</span>
                <span className="font-semibold text-[#e94560]">{Number(d.commissionDue).toFixed(2)} ج.م</span>
              </div>
            </div>
          ))}
          <DelegateForm />
        </div>
      </div>
    </div>
  )
}
