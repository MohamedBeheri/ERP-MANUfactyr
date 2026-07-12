import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Car, Printer, PackageOpen, Undo2 } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function DriversPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [activeOrders, recentSettlements] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        delegate: true,
        items: { include: { product: true } },
        invoices: { include: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.settlement.findMany({
      where: { returnedQty: { gt: 0 } },
      include: { delegate: true, deliveryOrder: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  // حساب المتبقي على كل عربية
  const vans = activeOrders.map((order) => {
    const deliveredByProduct = new Map<string, number>()
    for (const inv of order.invoices) {
      for (const item of inv.items) {
        deliveredByProduct.set(item.productId, (deliveredByProduct.get(item.productId) || 0) + item.quantity)
      }
    }
    const cargo = order.items.map((item) => {
      const delivered = deliveredByProduct.get(item.productId) || 0
      return {
        name: item.product.name,
        unit: item.product.unit,
        loaded: item.quantity,
        delivered,
        remaining: item.quantity - delivered,
      }
    })
    const totalLoaded = cargo.reduce((s, c) => s + c.loaded, 0)
    const totalRemaining = cargo.reduce((s, c) => s + c.remaining, 0)
    return { order, cargo, totalLoaded, totalRemaining }
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">شاشة السائقين</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          العربيات اللي في الطريق دلوقتي — الحمولة والمسلّم والمتبقي المتوقع رجوعه
        </p>
      </div>

      {vans.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center">
          <Car className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">مفيش عربيات في الطريق دلوقتي — كل الجولات اتسوّت.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {vans.map(({ order, cargo, totalLoaded, totalRemaining }) => (
          <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* رأس العربية */}
            <div className="bg-[#1a1a2e] text-white p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Car className="w-5 h-5 text-[#e9b44c]" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">
                    {order.delegate.name}
                    <span className="text-white/50 font-normal mr-2 tabular-nums">{order.delegate.carNumber || 'بدون رقم'}</span>
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {order.delegate.route || order.delegate.area || 'خط سير غير محدد'} · {order.orderNo}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/print/delivery/${order.id}`}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg"
                  aria-label="طباعة أمر التحميل"
                >
                  <Printer className="w-4 h-4" />
                </Link>
                <Link
                  href={`/delegates/${order.id}`}
                  className="px-3 py-2 bg-[#e94560] hover:bg-[#c73e54] rounded-lg text-xs font-semibold"
                >
                  التفاصيل
                </Link>
              </div>
            </div>

            {/* الحمولة */}
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="bg-blue-50 rounded-lg p-2.5">
                  <p className="text-lg font-bold text-blue-700 tabular-nums">{totalLoaded}</p>
                  <p className="text-[11px] text-gray-500">وحدة محمّلة</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2.5">
                  <p className="text-lg font-bold text-green-700 tabular-nums">{totalLoaded - totalRemaining}</p>
                  <p className="text-[11px] text-gray-500">اتسلّمت</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-2.5">
                  <p className="text-lg font-bold text-orange-600 tabular-nums">{totalRemaining}</p>
                  <p className="text-[11px] text-gray-500">متبقي (مرتجع متوقع)</p>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-b border-gray-100 text-xs">
                    <th className="pb-2 font-medium">الصنف</th>
                    <th className="pb-2 font-medium">محمّل</th>
                    <th className="pb-2 font-medium">مسلّم</th>
                    <th className="pb-2 font-medium">على العربية</th>
                  </tr>
                </thead>
                <tbody>
                  {cargo.map((c) => (
                    <tr key={c.name} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2 tabular-nums text-gray-500">{c.loaded} {c.unit}</td>
                      <td className="py-2 tabular-nums text-green-700">{c.delivered}</td>
                      <td className="py-2 tabular-nums font-bold">{c.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* آخر المرتجعات */}
      {recentSettlements.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Undo2 className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-bold text-[#1a1a2e]">آخر المرتجعات (رجعت للمخزن)</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentSettlements.map((s) => (
              <div key={s.id} className="p-4 px-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                    <PackageOpen className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {s.delegate.name} — {s.deliveryOrder?.orderNo || 'جولة'}
                    </p>
                    <p className="text-xs text-gray-400 tabular-nums">
                      {new Date(s.createdAt).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-orange-600 tabular-nums">
                  {s.returnedQty} وحدة مرتجعة
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
