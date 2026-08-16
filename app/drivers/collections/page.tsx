import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DelegateCollect } from '@/components/delegate-collect'
import { CustomerCollectionsList } from '@/components/customer-collections-list'

export const dynamic = 'force-dynamic'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export default async function MyCollectionsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true }, select: { id: true } })
  if (!delegate) redirect('/drivers')

  const [customers, methods, recent] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true, OR: [{ delegateId: delegate.id }, { salesRoute: { delegateId: delegate.id } }] },
      select: { id: true, name: true, phone: true, area: true, balance: true, salesRoute: { select: { name: true } }, collections: { where: { delegateId: delegate.id }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, type: true } }),
    prisma.collection.findMany({ where: { delegateId: delegate.id }, include: { customer: { select: { name: true } }, paymentMethod: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 15 }),
  ])

  const collectionRows = customers.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, area: c.area, routeName: c.salesRoute?.name || null,
    balance: Number(c.balance), lastCollectionAt: c.collections[0]?.createdAt?.toISOString() || null,
  }))

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">التحصيل والمديونيات</h1>
        <p className="text-sm text-gray-500 mt-0.5">سجّل تحصيلاتك من العملاء — بتدخل خزنتك وبتتحسب كزيارة تحصيل وبتخصم من مديونية العميل</p>
      </div>

      <DelegateCollect
        customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, balance: Number(c.balance) }))}
        methods={methods}
      />

      <CustomerCollectionsList rows={collectionRows} title="كل عملائي ومديونياتهم" />

      {/* آخر التحصيلات */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100"><h3 className="font-bold text-[#1a1a2e]">آخر تحصيلاتي ({recent.length})</h3></div>
        {recent.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">مفيش تحصيلات مسجّلة لسه</p> : (
          <div className="divide-y divide-gray-50">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 sm:px-5">
                <div className="flex-1 min-w-0"><p className="font-semibold text-sm text-[#1a1a2e] truncate">{r.customer.name}</p><p className="text-[11px] text-gray-400 tabular-nums">{new Date(r.createdAt).toLocaleString('ar-EG')} · {r.paymentMethod.name} · {r.collectionNo}</p></div>
                <span className="text-sm font-bold tabular-nums text-green-700">{money(Number(r.amount))} ج.م</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
