import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Printer, Package, MapPin, FileCheck2 } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeliverForm } from '@/components/deliver-form'
import { SettleForm } from '@/components/settle-form'

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
      {/* الترويسة */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/delegates"
            className="p-2 text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 rounded-lg"
            aria-label="رجوع للمندوبين"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#1a1a2e] tabular-nums">{deliveryOrder.orderNo}</h1>
            <p className="text-sm text-gray-500">
              {deliveryOrder.delegate.name} · {deliveryOrder.delegate.carNumber || 'بدون عربية'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/print/delivery/${deliveryOrder.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-medium hover:bg-[#0a2545]"
          >
            <Printer className="w-4 h-4" />
            أمر التحميل
          </Link>
          {deliveryOrder.settlement && (
            <Link
              href={`/print/settlement/${deliveryOrder.settlement.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              <Printer className="w-4 h-4" />
              محضر التسوية
            </Link>
          )}
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${STATUS_COLOR[deliveryOrder.status]}`}>
            {STATUS_LABEL[deliveryOrder.status]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          {/* الأصناف المحمّلة */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-5 pb-3">
              <Package className="w-5 h-5 text-[#0f3460]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">الأصناف المحمّلة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                    <th className="p-3 font-medium">الصنف</th>
                    <th className="p-3 font-medium">المحمّل</th>
                    <th className="p-3 font-medium">المسلّم</th>
                    <th className="p-3 font-medium">المتبقي على العربية</th>
                  </tr>
                </thead>
                <tbody>
                  {remaining.map((item) => (
                    <tr key={item.productId} className="border-b border-gray-50 last:border-0">
                      <td className="p-3 font-semibold">{item.productName}</td>
                      <td className="p-3 tabular-nums">{item.loaded} {item.unit}</td>
                      <td className="p-3 tabular-nums text-green-700">{item.delivered} {item.unit}</td>
                      <td className="p-3 tabular-nums font-bold">{item.remaining} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* سجل التسليمات */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-[#e94560]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">سجل التسليمات ({deliveryOrder.invoices.length})</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">محصّل نقدي</p>
                <p className="font-bold text-green-600 tabular-nums">{cashTotal.toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">آجل</p>
                <p className="font-bold text-yellow-700 tabular-nums">{creditTotal.toLocaleString('ar-EG')} ج.م</p>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {deliveryOrder.invoices.length === 0 && (
                <p className="text-sm text-gray-500 py-2">لسه مفيش تسليمات مسجّلة.</p>
              )}
              {deliveryOrder.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{inv.customer.name}</p>
                    <p className="text-xs text-gray-400 tabular-nums">{inv.invoiceNo}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <p className="font-semibold text-sm tabular-nums">{Number(inv.netAmount).toLocaleString('ar-EG')} ج.م</p>
                      <p className="text-xs text-gray-400">{inv.type === 'CASH' ? 'نقدي' : 'آجل'}</p>
                    </div>
                    <Link
                      href={`/print/invoice/${inv.id}`}
                      className="p-2 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg"
                      aria-label="طباعة الفاتورة"
                    >
                      <Printer className="w-4 h-4" />
                    </Link>
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
            <div className="bg-white p-5 rounded-xl shadow-sm space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <FileCheck2 className="w-5 h-5 text-green-600" />
                <h3 className="text-base font-bold text-[#1a1a2e]">ملخص التسوية</h3>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">المباع</span>
                <span className="font-semibold tabular-nums">{deliveryOrder.settlement.soldQty}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">المرتجع</span>
                <span className="font-semibold tabular-nums">{deliveryOrder.settlement.returnedQty}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">نقدي</span>
                <span className="font-semibold tabular-nums">{Number(deliveryOrder.settlement.cashAmount).toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">آجل</span>
                <span className="font-semibold tabular-nums">{Number(deliveryOrder.settlement.creditAmount).toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="text-gray-500">عمولة المندوب</span>
                <span className="font-semibold text-[#e94560] tabular-nums">
                  {Number(deliveryOrder.settlement.commission).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
