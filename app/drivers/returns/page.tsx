import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Undo2, AlertTriangle } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeliveryReturnForm } from '@/components/delivery-return-form'

export const dynamic = 'force-dynamic'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export default async function MyReturnsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true }, select: { id: true } })
  if (!delegate) redirect('/drivers')

  // المرتجع بيرجّع البضاعة على عربية الجولة الحالية — فلازم يكون في جولة شغالة
  const activeOrder = await prisma.deliveryOrder.findFirst({
    where: { delegateId: delegate.id, status: 'IN_PROGRESS' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderNo: true },
  })

  const [customers, recent] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true, OR: [{ delegateId: delegate.id }, { salesRoute: { delegateId: delegate.id } }] },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // آخر مرتجعات المندوب (من جولاته)
    prisma.deliveryReturn.findMany({
      where: { deliveryOrder: { delegateId: delegate.id } },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2"><Undo2 className="w-6 h-6 text-orange-500" /> المرتجعات</h1>
        <p className="text-sm text-gray-500 mt-0.5">سجّل مرتجع من فاتورة سابقة لأي عميل — البضاعة بترجع على عربيتك في الجولة الحالية</p>
      </div>

      {!activeOrder ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800">مفيش جولة شغالة دلوقتي</p>
            <p className="text-sm text-amber-700 mt-1">المرتجع بيرجّع البضاعة على العربية، فلازم يكون عندك جولة توزيع شغالة الأول. ابدأ/أكمل جولتك من شاشة المندوب.</p>
            <Link href="/drivers" className="inline-block mt-3 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600">رجوع لشاشة المندوب</Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">الجولة الحالية: <span className="font-semibold text-gray-600">{activeOrder.orderNo}</span></p>
          <DeliveryReturnForm deliveryOrderId={activeOrder.id} customers={customers} alwaysOpen />
        </>
      )}

      {/* آخر المرتجعات */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100"><h3 className="font-bold text-[#1a1a2e]">آخر مرتجعاتي ({recent.length})</h3></div>
        {recent.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">مفيش مرتجعات مسجّلة لسه</p> : (
          <div className="divide-y divide-gray-50">
            {recent.map((r) => {
              const units = r.items.reduce((s, it) => s + Number(it.quantity), 0)
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 sm:px-5">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#1a1a2e] truncate">{r.customerName}</p>
                    <p className="text-[11px] text-gray-400 tabular-nums">{new Date(r.createdAt).toLocaleString('ar-EG')} · {r.returnNo} · {units} وحدة{r.refundCash ? ' · رد نقدي' : ' · خصم آجل'}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-orange-700">{money(Number(r.totalValue))} ج.م</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
