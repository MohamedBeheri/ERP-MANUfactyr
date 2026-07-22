import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Car, Printer, PackageOpen, Undo2, ShoppingCart, Building2, ClipboardCheck,
  Clock, MapPin, Truck,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AlBadrLogo } from '@/components/albadr-logo'

export const dynamic = 'force-dynamic'

const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`
const timeOf = (d: Date) => new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

export default async function DriversPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  // لو المستخدم الداخل مربوط بمندوب → صفحته الشخصية
  const myDelegate = await prisma.delegate.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { vehicle: true },
  })

  if (myDelegate) return <DelegateHome delegate={myDelegate} userName={session.user.name || myDelegate.name} />
  return <FleetOverview />
}

/* ================= شاشة المندوب الشخصية ================= */
async function DelegateHome({ delegate, userName }: { delegate: any; userName: string }) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const activeOrder = await prisma.deliveryOrder.findFirst({
    where: { delegateId: delegate.id, status: 'IN_PROGRESS' },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { product: true } },
      invoices: { where: { createdAt: { gte: todayStart } }, include: { customer: true, items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } },
      keyAccountSupplies: { where: { createdAt: { gte: todayStart } }, include: { branch: true, keyAccount: true, items: true }, orderBy: { createdAt: 'desc' } },
      returns: { where: { createdAt: { gte: todayStart } }, include: { customer: true, items: true }, orderBy: { createdAt: 'desc' } },
    },
  })

  // المتبقي على العربية لكل صنف
  const cargo = activeOrder
    ? await (async () => {
        const full = await prisma.deliveryOrder.findUnique({
          where: { id: activeOrder.id },
          include: {
            items: { include: { product: true } },
            invoices: { include: { items: true } },
            keyAccountSupplies: { include: { items: true } },
            returns: { include: { items: true } },
          },
        })
        if (!full) return []
        return full.items.map((it) => {
          const delivered =
            full.invoices.flatMap((i) => i.items).filter((x) => x.productId === it.productId).reduce((s, x) => s + x.quantity, 0) +
            full.keyAccountSupplies.flatMap((sp) => sp.items).filter((x) => x.productId === it.productId).reduce((s, x) => s + x.quantity, 0)
          const returned = full.returns.flatMap((r) => r.items).filter((x) => x.productId === it.productId).reduce((s, x) => s + x.quantity, 0)
          return { name: it.product.name, unit: it.product.unit, loaded: it.quantity, delivered, remaining: it.quantity - delivered + returned }
        })
      })()
    : []

  // حركات اليوم موحّدة بالوقت
  type Move = { time: Date; kind: string; title: string; sub: string; amount: string; color: string }
  const moves: Move[] = []
  if (activeOrder) {
    for (const inv of activeOrder.invoices) {
      moves.push({
        time: inv.createdAt, kind: 'بيع',
        title: `بيع لـ ${inv.customer.name}`,
        sub: inv.items.filter((x) => !x.isBonus).map((x) => `${x.product.name} ×${x.quantity}`).join('، '),
        amount: `${egp(Number(inv.netAmount))} · ${inv.paymentMethod}`,
        color: 'text-green-700 bg-green-50',
      })
    }
    for (const sp of activeOrder.keyAccountSupplies) {
      moves.push({
        time: sp.createdAt, kind: 'توريد',
        title: `توريد لفرع ${sp.branch.name} (${sp.keyAccount.name})`,
        sub: `${sp.items.reduce((s, x) => s + x.quantity, 0)} قطعة`,
        amount: `${egp(Number(sp.netAmount))} · مطالبة`,
        color: 'text-amber-700 bg-amber-50',
      })
    }
    for (const r of activeOrder.returns) {
      moves.push({
        time: r.createdAt, kind: 'مرتجع',
        title: `مرتجع من ${r.customer?.name || r.customerName || 'عميل'}`,
        sub: `${r.items.reduce((s, x) => s + x.quantity, 0)} قطعة رجعت للعربية`,
        amount: `${egp(Number(r.totalValue))} · ${r.refundCash ? 'رد نقدي' : 'خصم آجل'}`,
        color: 'text-orange-700 bg-orange-50',
      })
    }
  }
  moves.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const cashToday = activeOrder ? activeOrder.invoices.reduce((s, i) => s + Number(i.paidAmount), 0) : 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور'
  const tourHref = activeOrder ? `/delegates/${activeOrder.id}` : null

  const boxes = [
    { label: 'تنزيل بضاعة للعملاء', Icon: ShoppingCart, cls: 'from-[#0f3460] to-[#16213e]' },
    { label: 'تسليم كبار الموردين', Icon: Building2, cls: 'from-amber-500 to-amber-600' },
    { label: 'أمر مرتجع من عميل', Icon: Undo2, cls: 'from-orange-500 to-orange-600' },
    { label: 'تسوية نهاية اليوم', Icon: ClipboardCheck, cls: 'from-[#e94560] to-[#c73e54]' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* بانر الترحيب */}
      <div className="relative overflow-hidden rounded-3xl text-white p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 60%, #16213e 100%)' }}>
        <div className="absolute -left-10 -bottom-16 opacity-[0.07] pointer-events-none">
          <AlBadrLogo className="w-72 h-72" />
        </div>
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-black">{greeting}، {userName.split(' ')[0]} 👋</h1>
          <p className="text-white/60 text-sm mt-1">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="flex flex-wrap gap-2 mt-4 text-xs font-bold">
            {delegate.vehicle && (
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg tabular-nums"><Car className="w-4 h-4 text-[#e9b44c]" /> {delegate.vehicle.plateNo}</span>
            )}
            {(delegate.route || delegate.area) && (
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg"><MapPin className="w-4 h-4 text-[#e9b44c]" /> خط السير: {delegate.route || delegate.area}</span>
            )}
            {activeOrder ? (
              <span className="flex items-center gap-1.5 bg-green-500/20 text-green-300 px-3 py-1.5 rounded-lg tabular-nums"><Truck className="w-4 h-4" /> جولة شغالة: {activeOrder.orderNo}</span>
            ) : (
              <span className="bg-white/10 px-3 py-1.5 rounded-lg text-white/60">مفيش جولة شغالة النهارده</span>
            )}
            {cashToday > 0 && <span className="bg-white/10 px-3 py-1.5 rounded-lg tabular-nums">محصّل اليوم: {egp(cashToday)}</span>}
          </div>
        </div>
      </div>

      {/* الأربع مربعات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {boxes.map(({ label, Icon, cls }) => (
          tourHref ? (
            <Link key={label} href={tourHref} className={`group bg-gradient-to-br ${cls} text-white rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center gap-3 text-center shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200`}>
              <Icon className="w-9 h-9 sm:w-10 sm:h-10" strokeWidth={1.8} />
              <span className="font-bold text-sm sm:text-base">{label}</span>
            </Link>
          ) : (
            <div key={label} className="bg-gray-100 text-gray-400 rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center gap-3 text-center cursor-not-allowed">
              <Icon className="w-9 h-9 sm:w-10 sm:h-10" strokeWidth={1.8} />
              <span className="font-bold text-sm sm:text-base">{label}</span>
              <span className="text-[10px]">مستني تحميل العربية</span>
            </div>
          )
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* حمولة العربية */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2"><Car className="w-5 h-5 text-[#0f3460]" /> حمولة العربية</h3>
            {activeOrder && (
              <Link href={`/print/delivery/${activeOrder.id}`} className="flex items-center gap-1 text-xs text-[#0f3460] font-bold hover:underline"><Printer className="w-3.5 h-3.5" /> أمر التحميل</Link>
            )}
          </div>
          {cargo.length === 0 ? (
            <p className="p-5 pt-0 text-sm text-gray-500">مفيش حمولة — العربية لسه ما اتحمّلتش.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50 text-xs">
                    <th className="p-3 font-medium">الصنف</th>
                    <th className="p-3 font-medium">محمّل</th>
                    <th className="p-3 font-medium">مسلّم</th>
                    <th className="p-3 font-medium">على العربية</th>
                  </tr>
                </thead>
                <tbody>
                  {cargo.map((c) => (
                    <tr key={c.name} className="border-b border-gray-50 last:border-0">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 tabular-nums text-gray-500">{c.loaded} {c.unit}</td>
                      <td className="p-3 tabular-nums text-green-700">{c.delivered}</td>
                      <td className="p-3 tabular-nums font-bold">{c.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* حركات اليوم */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-[#e94560]" /> حركات اليوم ({moves.length})</h3>
          {moves.length === 0 && <p className="text-sm text-gray-500">مفيش حركات مسجّلة النهارده لسه.</p>}
          <div className="space-y-2">
            {moves.map((m, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${m.color}`}>{m.kind}</span>
                    {m.title}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{m.sub}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-xs font-semibold tabular-nums">{m.amount}</p>
                  <p className="text-[10px] text-gray-400 tabular-nums flex items-center gap-1 justify-end mt-0.5"><Clock className="w-3 h-3" /> {timeOf(m.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= شاشة الإدارة: كل العربيات في الطريق ================= */
async function FleetOverview() {
  const [activeOrders, recentSettlements] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        delegate: { include: { vehicle: true } },
        items: { include: { product: true } },
        invoices: { include: { items: true } },
        keyAccountSupplies: { include: { items: true } },
        returns: { include: { items: true } },
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

  const vans = activeOrders.map((order) => {
    const deliveredByProduct = new Map<string, number>()
    for (const inv of order.invoices) for (const item of inv.items) deliveredByProduct.set(item.productId, (deliveredByProduct.get(item.productId) || 0) + item.quantity)
    for (const sup of order.keyAccountSupplies) for (const item of sup.items) deliveredByProduct.set(item.productId, (deliveredByProduct.get(item.productId) || 0) + item.quantity)
    const returnedByProduct = new Map<string, number>()
    for (const r of order.returns) for (const item of r.items) returnedByProduct.set(item.productId, (returnedByProduct.get(item.productId) || 0) + item.quantity)
    const cargo = order.items.map((item) => {
      const delivered = deliveredByProduct.get(item.productId) || 0
      const returned = returnedByProduct.get(item.productId) || 0
      return { name: item.product.name, unit: item.product.unit, loaded: item.quantity, delivered, remaining: item.quantity - delivered + returned }
    })
    const totalLoaded = cargo.reduce((s, c) => s + c.loaded, 0)
    const totalRemaining = cargo.reduce((s, c) => s + c.remaining, 0)
    return { order, cargo, totalLoaded, totalRemaining }
  })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">شاشة السائقين</h1>
        <p className="text-sm text-gray-500 mt-0.5">العربيات اللي في الطريق دلوقتي — الحمولة والمسلّم والمتبقي المتوقع رجوعه</p>
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
            <div className="bg-[#1a1a2e] text-white p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Car className="w-5 h-5 text-[#e9b44c]" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">
                    {order.delegate.name}
                    <span className="text-white/50 font-normal mr-2 tabular-nums">{order.delegate.vehicle?.plateNo || order.delegate.carNumber || 'بدون رقم'}</span>
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {order.delegate.route || order.delegate.area || 'خط سير غير محدد'} · {order.orderNo} · {timeOf(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/print/delivery/${order.id}`} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg" aria-label="طباعة أمر التحميل">
                  <Printer className="w-4 h-4" />
                </Link>
                <Link href={`/delegates/${order.id}`} className="px-3.5 py-2 bg-[#e9b44c] text-[#1a1a2e] hover:bg-[#d9a43c] rounded-lg text-xs font-bold">
                  فتح شاشة التسليم
                </Link>
              </div>
            </div>

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
                    <p className="font-semibold text-sm truncate">{s.delegate.name} — {s.deliveryOrder?.orderNo || 'جولة'}</p>
                    <p className="text-xs text-gray-400 tabular-nums">{new Date(s.createdAt).toLocaleDateString('ar-EG')} · {timeOf(s.createdAt)}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-orange-600 tabular-nums">{s.returnedQty} وحدة مرتجعة</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
