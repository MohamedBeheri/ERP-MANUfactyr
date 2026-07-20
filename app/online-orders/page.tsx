import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStoreSettings } from '@/lib/store'
import { OnlineOrdersManager } from '@/components/online-orders-manager'

export const dynamic = 'force-dynamic'

export default async function OnlineOrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [settings, orders] = await Promise.all([
    getStoreSettings(),
    prisma.onlineOrder.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
  ])

  const pending = orders.filter((o) => o.status === 'PENDING').length
  const active = orders.filter((o) => ['CONFIRMED', 'PREPARING', 'SHIPPED'].includes(o.status)).length
  const delivered = orders.filter((o) => o.status === 'DELIVERED').length
  const revenue = orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + Number(o.total), 0)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">طلبات الموقع</h1>
        <p className="text-sm text-gray-500 mt-0.5">إدارة كاملة لطلبات المتجر — بحث وتعديل وحذف وتواصل مع العميل</p>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-yellow-600 tabular-nums">{pending}</p>
          <p className="text-xs text-gray-500">طلبات جديدة</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-blue-600 tabular-nums">{active}</p>
          <p className="text-xs text-gray-500">قيد التنفيذ</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-green-600 tabular-nums">{delivered}</p>
          <p className="text-xs text-gray-500">اتسلّمت</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-[#1a1a2e] tabular-nums">{revenue.toLocaleString('ar-EG')} ج.م</p>
          <p className="text-xs text-gray-500">إيرادات المُسلَّم</p>
        </div>
      </div>

      <OnlineOrdersManager
        storeName={settings.storeName}
        orders={orders.map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          customerName: o.customerName,
          phone: o.phone,
          address: o.address,
          notes: o.notes,
          subtotal: Number(o.subtotal),
          deliveryFee: Number(o.deliveryFee),
          total: Number(o.total),
          paymentMethod: o.paymentMethod,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          itemsText: o.items.map((i) => `${i.productName} ×${i.quantity}`).join('، '),
        }))}
      />
    </div>
  )
}
