import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeliverForm } from '@/components/deliver-form'
import { SettleForm } from '@/components/settle-form'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'معلّقة',
  IN_PROGRESS: 'شغالة',
  COMPLETED: 'اتسوّت',
  CANCELLED: 'ملغية',
}

export default async function DeliveryOrderPage({ params }: { params: { deliveryOrderId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [deliveryOrder, customers] = await Promise.all([
    prisma.deliveryOrder.findUnique({
      where: { id: params.deliveryOrderId },
      include: {
        delegate: true,
        settlement: true,
        items: { include: { product: true } },
        invoices: {
          include: { customer: true, items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  if (!deliveryOrder) notFound()

  const remaining = deliveryOrder.items.map((item) => {
    const delivered = deliveryOrder.invoices
      .flatMap((inv) => inv.items)
      .filter((invItem) => invItem.productId === item.productId)
      .reduce((sum, invItem) => sum + invItem.quantity, 0)

    return {
      productId: item.productId,
      productName: item.product.name,
      unit: item.product.unit,
      sellPrice: Number(item.product.sellPrice),
      loaded: item.quantity,
      delivered,
      remaining: item.quantity - delivered,
    }
  })

  const cashTotal = deliveryOrder.invoices.filter((i) => i.type === 'CASH').reduce((s, i) => s + Number(i.netAmount), 0)
  const creditTotal = deliveryOrder.invoices.filter((i) => i.type === 'CREDIT').reduce((s, i) => s + Number(i.netAmount), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">{deliveryOrder.orderNo}</h1>
          <p className="text-gray-500">
            {deliveryOrder.delegate.name} · {deliveryOrder.delegate.carNumber || '—'}
          </p>
        </div>
        <span className="px-4 py-2 rounded-full text-sm font-semibold bg-orange-50 text-orange-600">
          {STATUS_LABEL[deliveryOrder.status]}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">📦 الأصناف المحمّلة</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-b border-gray-100">
                  <th className="pb-2">الصنف</th>
                  <th className="pb-2">المحمّل</th>
                  <th className="pb-2">المسلّم</th>
                  <th className="pb-2">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {remaining.map((item) => (
                  <tr key={item.productId} className="border-b border-gray-50 last:border-0">
                    <td className="py-2">{item.productName}</td>
                    <td className="py-2">
                      {item.loaded} {item.unit}
                    </td>
                    <td className="py-2">
                      {item.delivered} {item.unit}
                    </td>
                    <td className="py-2 font-semibold">
                      {item.remaining} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">📍 سجل التسليمات ({deliveryOrder.invoices.length})</h3>
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-gray-500">نقدي</p>
                <p className="font-bold text-green-600">{cashTotal.toFixed(2)} ج.م</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-gray-500">آجل</p>
                <p className="font-bold text-yellow-700">{creditTotal.toFixed(2)} ج.م</p>
              </div>
            </div>
            <div className="space-y-3">
              {deliveryOrder.invoices.length === 0 && (
                <p className="text-sm text-gray-500">لسه مفيش تسليمات مسجّلة.</p>
              )}
              {deliveryOrder.invoices.map((inv) => (
                <div key={inv.id} className="flex justify-between border-b border-gray-50 last:border-0 pb-3">
                  <div>
                    <p className="font-semibold text-sm">{inv.customer.name}</p>
                    <p className="text-xs text-gray-400">{inv.invoiceNo}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">{Number(inv.netAmount).toFixed(2)} ج.م</p>
                    <p className="text-xs text-gray-400">{inv.type === 'CASH' ? 'نقدي' : 'آجل'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {deliveryOrder.status === 'IN_PROGRESS' && (
            <>
              <DeliverForm deliveryOrderId={deliveryOrder.id} customers={customers} remainingItems={remaining} />
              <SettleForm deliveryOrderId={deliveryOrder.id} remainingItems={remaining} />
            </>
          )}

          {deliveryOrder.settlement && (
            <div className="bg-white p-6 rounded-xl shadow-sm space-y-2">
              <h3 className="text-lg font-bold text-[#1a1a2e] mb-2">✅ ملخص التسوية</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">المباع</span>
                <span className="font-semibold">{deliveryOrder.settlement.soldQty}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">المرتجع</span>
                <span className="font-semibold">{deliveryOrder.settlement.returnedQty}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">نقدي</span>
                <span className="font-semibold">{Number(deliveryOrder.settlement.cashAmount).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">آجل</span>
                <span className="font-semibold">{Number(deliveryOrder.settlement.creditAmount).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">عمولة المندوب</span>
                <span className="font-semibold text-[#e94560]">
                  {Number(deliveryOrder.settlement.commission).toFixed(2)} ج.م
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
