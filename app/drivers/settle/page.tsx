import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, AlertTriangle } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SettleForm } from '@/components/settle-form'

export const dynamic = 'force-dynamic'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export default async function MySettlePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true }, select: { id: true } })
  if (!delegate) redirect('/drivers')

  const order = await prisma.deliveryOrder.findFirst({
    where: { delegateId: delegate.id, status: 'IN_PROGRESS' },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { product: true } },
      invoices: { include: { items: true } },
      keyAccountSupplies: { include: { items: true } },
      returns: { include: { items: true } },
    },
  })

  // المتبقي على العربية لكل صنف = المحمّل − المُسلّم + اللي رجع للعربية
  const remaining = order
    ? order.items.map((item) => {
        const invDelivered = order.invoices.flatMap((inv) => inv.items).filter((it) => it.productId === item.productId).reduce((s, it) => s + Number(it.quantity), 0)
        const supDelivered = order.keyAccountSupplies.flatMap((sp) => sp.items).filter((it) => it.productId === item.productId).reduce((s, it) => s + Number(it.quantity), 0)
        const returnedToVan = order.returns.flatMap((r) => r.items).filter((it) => it.productId === item.productId).reduce((s, it) => s + Number(it.quantity), 0)
        return {
          productId: item.productId,
          productName: item.product.name,
          unit: item.product.unit,
          remaining: Number(item.quantity) - (invDelivered + supDelivered) + returnedToVan,
        }
      })
    : []

  // ملخص سريع لحركة اليوم في الجولة (المباع والمحصّل بيتحسبوا تلقائي في التسوية)
  const cashPaid = order ? order.invoices.reduce((s, inv) => s + Number(inv.paidAmount), 0) : 0
  const creditLeft = order ? order.invoices.reduce((s, inv) => s + (Number(inv.netAmount) - Number(inv.paidAmount)), 0) : 0
  const invoiceCount = order ? order.invoices.length : 0

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-[#e94560]" /> تسوية نهاية اليوم</h1>
        <p className="text-sm text-gray-500 mt-0.5">قفل جولة اليوم من هنا مباشرة — المباع والمحصّل والعمولة بيتحسبوا تلقائي، وانت بس بتأكّد المرتجع/الجرد</p>
      </div>

      {!order ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800">مفيش جولة شغالة دلوقتي</p>
            <p className="text-sm text-amber-700 mt-1">لازم يكون عندك جولة توزيع شغالة عشان تقفلها. ابدأ/أكمل جولتك من شاشة المندوب.</p>
            <Link href="/drivers" className="inline-block mt-3 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600">رجوع لشاشة المندوب</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-l from-[#0f3460] to-[#16213e] rounded-2xl p-4 sm:p-5 text-white">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-bold text-base">جولة {order.orderNo}</h3>
              <span className="text-xs text-white/60">{invoiceCount} فاتورة تسليم</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div className="bg-white/10 rounded-xl p-3"><p className="text-[11px] text-white/60">محصّل نقدًا اليوم</p><p className="font-bold tabular-nums">{money(cashPaid)} ج.م</p></div>
              <div className="bg-white/10 rounded-xl p-3"><p className="text-[11px] text-white/60">آجل على العملاء</p><p className="font-bold tabular-nums">{money(creditLeft)} ج.م</p></div>
              <div className="bg-white/10 rounded-xl p-3"><p className="text-[11px] text-white/60">أصناف باقية على العربية</p><p className="font-bold tabular-nums">{remaining.filter((r) => r.remaining > 0).length}</p></div>
            </div>
            <p className="text-[11px] text-white/50 mt-2">التسوية بتقفل الجولة وبتحوّل فلوس البيع لخزنتك. تفصيل الوسائل والتحصيل بيبان في شاشة «التحصيل والمديونيات».</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <SettleForm deliveryOrderId={order.id} remainingItems={remaining} />
          </div>
        </>
      )}
    </div>
  )
}
