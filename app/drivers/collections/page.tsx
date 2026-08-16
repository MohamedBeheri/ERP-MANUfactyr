import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Printer } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DelegateCollect } from '@/components/delegate-collect'
import { CustomerCollectionsList } from '@/components/customer-collections-list'
import { DelegateTreasurySettle } from '@/components/delegate-treasury-settle'

export const dynamic = 'force-dynamic'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export default async function MyCollectionsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true }, select: { id: true } })
  if (!delegate) redirect('/drivers')

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const [customers, methods, recent, todaySettlements, todayCollections] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true, OR: [{ delegateId: delegate.id }, { salesRoute: { delegateId: delegate.id } }] },
      select: { id: true, name: true, phone: true, area: true, balance: true, salesRoute: { select: { name: true } }, collections: { where: { delegateId: delegate.id }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, type: true } }),
    prisma.collection.findMany({ where: { delegateId: delegate.id }, include: { customer: { select: { name: true } }, paymentMethod: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 15 }),
    // مبيعات اليوم المسوّاة (من تسويات الجولات)
    prisma.settlement.findMany({ where: { delegateId: delegate.id, createdAt: { gte: todayStart } }, select: { cashOnlyAmount: true, instapayAmount: true, walletAmount: true } }),
    // تحصيلات اليوم بالطرق
    prisma.collection.findMany({ where: { delegateId: delegate.id, createdAt: { gte: todayStart } }, select: { amount: true, paymentMethod: { select: { name: true } } } }),
  ])

  // ملخص تسوية اليوم: فلوس البيع + فلوس التحصيل + طرق الدفع
  const salesCash = todaySettlements.reduce((s, x) => s + Number(x.cashOnlyAmount), 0)
  const salesInsta = todaySettlements.reduce((s, x) => s + Number(x.instapayAmount), 0)
  const salesWallet = todaySettlements.reduce((s, x) => s + Number(x.walletAmount), 0)
  const collByMethod = new Map<string, number>()
  for (const c of todayCollections) collByMethod.set(c.paymentMethod.name, (collByMethod.get(c.paymentMethod.name) || 0) + Number(c.amount))
  const collectTotal = todayCollections.reduce((s, c) => s + Number(c.amount), 0)
  const dayTotal = salesCash + salesInsta + salesWallet + collectTotal

  // خزنة المندوب الفعلية + تسوياتها المجمّعة (سندات مش مرتبطة بجولة)
  const [myTreasury, boxSettlements] = await Promise.all([
    prisma.treasury.findUnique({ where: { delegateId: delegate.id }, select: { balance: true } }),
    prisma.treasurySettlement.findMany({
      where: { delegateId: delegate.id, deliveryOrderId: null },
      include: { acceptedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 10,
    }),
  ])
  const treasuryBalance = Number(myTreasury?.balance || 0)
  const pendingTotal = boxSettlements.filter((s) => s.status === 'PENDING').reduce((s, x) => s + Number(x.amount), 0)

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

      {/* ملخص تسوية اليوم: فلوس البيع + فلوس التحصيل + طرق الدفع */}
      <div className="bg-gradient-to-l from-[#0f3460] to-[#16213e] rounded-2xl p-4 sm:p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-bold text-base">ملخص تسوية اليوم في خزنتك</h3>
          <span className="text-lg font-black tabular-nums">الإجمالي {money(dayTotal)} ج.م</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="bg-white/10 rounded-xl p-3"><p className="text-[11px] text-white/60">بيع كاش</p><p className="font-bold tabular-nums">{money(salesCash)}</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-[11px] text-white/60">بيع إنستا</p><p className="font-bold tabular-nums">{money(salesInsta)}</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-[11px] text-white/60">بيع محفظة</p><p className="font-bold tabular-nums">{money(salesWallet)}</p></div>
          <div className="bg-emerald-500/25 rounded-xl p-3"><p className="text-[11px] text-white/70">إجمالي التحصيل</p><p className="font-bold tabular-nums">{money(collectTotal)}</p></div>
        </div>
        {collByMethod.size > 0 && (
          <p className="text-[11px] text-white/70 mt-2">تفصيل التحصيل بالطرق: {Array.from(collByMethod.entries()).map(([m, v]) => `${m} ${money(v)}`).join(' · ')}</p>
        )}
        <p className="text-[11px] text-white/50 mt-1">دي حركة اليوم (بيع + تحصيل). رصيد خزنتك الكلي وتسويته تحت 👇</p>
      </div>

      {/* خزنة المندوب الموحّدة + زر التسوية */}
      <DelegateTreasurySettle
        balance={treasuryBalance}
        pendingTotal={pendingTotal}
        settlements={boxSettlements.map((s) => ({ id: s.id, settlementNo: s.settlementNo, amount: Number(s.amount), status: s.status, createdAt: s.createdAt.toISOString(), acceptedByName: s.acceptedBy?.name || null }))}
      />

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
                <a href={`/print/collection/${r.id}`} target="_blank" rel="noopener" className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg" title="طباعة الإيصال"><Printer className="w-4 h-4" /></a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
