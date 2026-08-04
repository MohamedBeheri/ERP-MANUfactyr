import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

// ترتيب أيام أسبوع العمل — القيمة = getDay
const WEEK_DAYS: { day: number; label: string }[] = [
  { day: 6, label: 'السبت' },
  { day: 0, label: 'الأحد' },
  { day: 1, label: 'الإثنين' },
  { day: 2, label: 'الثلاثاء' },
  { day: 3, label: 'الأربعاء' },
  { day: 4, label: 'الخميس' },
  { day: 5, label: 'الجمعة' },
]

// تقرير مفصّل لمندوب واحد: بياناته + خط السير الأسبوعي الكامل + أداء الفترة بالجولات
export default async function DelegateDetailReport({
  params: rawParams,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await rawParams
  const searchParams = await rawSearchParams
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [delegate, routePlan, periodInvoices, unloads] = await Promise.all([
    prisma.delegate.findUnique({
      where: { id: params.id },
      include: {
        vehicle: true,
        user: { select: { name: true, commissionRate: true, monthlyTarget: true } },
        settlements: {
          where: { createdAt: period },
          orderBy: { createdAt: 'desc' },
          include: { deliveryOrder: { select: { orderNo: true } } },
        },
      },
    }),
    prisma.routePlanEntry.findMany({
      where: { delegateId: params.id },
      include: { customer: { select: { id: true, name: true, area: true, phone: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.invoice.findMany({
      where: { delegateId: params.id, createdAt: period },
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.unloadOrder.findMany({
      where: { delegateId: params.id, createdAt: period },
      include: { items: { include: { product: { select: { name: true, unit: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  if (!delegate) notFound()

  // تحقيق الفترة: عملاء مميزين + إجمالي فواتير
  const achievedIds = new Set(periodInvoices.map((i) => i.customerId))
  const target = Number(delegate.weeklyCustomerTarget)

  // تجميع أرقام التسويات
  const S = delegate.settlements.reduce(
    (a, x) => {
      const parts = Number(x.cashOnlyAmount) + Number(x.instapayAmount) + Number(x.walletAmount)
      return {
        collected: a.collected + Number(x.cashAmount),
        cashOnly: a.cashOnly + (parts === 0 ? Number(x.cashAmount) : Number(x.cashOnlyAmount)),
        insta: a.insta + Number(x.instapayAmount),
        wallet: a.wallet + Number(x.walletAmount),
        credit: a.credit + Number(x.creditAmount),
        commission: a.commission + Number(x.commission),
        sold: a.sold + Number(x.soldQty),
        returned: a.returned + Number(x.returnedQty),
      }
    },
    { collected: 0, cashOnly: 0, insta: 0, wallet: 0, credit: 0, commission: 0, sold: 0, returned: 0 }
  )

  // خط السير الأسبوعي مجمّع بالأيام
  const planByDay = new Map<number, typeof routePlan>()
  for (const e of routePlan) {
    const list = planByDay.get(e.dayOfWeek) || []
    list.push(e)
    planByDay.set(e.dayOfWeek, list)
  }
  const planTotal = routePlan.length

  // كشف الجولات
  const roundRows = delegate.settlements.map((s) => {
    const parts = Number(s.cashOnlyAmount) + Number(s.instapayAmount) + Number(s.walletAmount)
    const cashOnly = parts === 0 ? Number(s.cashAmount) : Number(s.cashOnlyAmount)
    return [
      s.deliveryOrder?.orderNo || '—',
      new Date(s.createdAt).toLocaleDateString('ar-EG'),
      fmt(Number(s.soldQty)),
      fmt(Number(s.returnedQty)),
      money(cashOnly),
      <span key="i" className="text-purple-700">{money(Number(s.instapayAmount))}</span>,
      <span key="w" className="text-blue-700">{money(Number(s.walletAmount))}</span>,
      <span key="t" className="font-bold">{money(Number(s.cashAmount))}</span>,
      money(Number(s.creditAmount)),
      <span key="c" className="text-[#e94560] font-bold">{money(Number(s.commission))}</span>,
    ]
  })

  // كشف عملاء الفترة (المتحققين)
  const custStat = new Map<string, { name: string; invoices: number; total: number; paid: number }>()
  for (const inv of periodInvoices) {
    const prev = custStat.get(inv.customerId) || { name: inv.customer.name, invoices: 0, total: 0, paid: 0 }
    prev.invoices += 1
    prev.total += Number(inv.netAmount)
    prev.paid += Number(inv.paidAmount)
    custStat.set(inv.customerId, prev)
  }
  const custRows = Array.from(custStat.values()).sort((a, b) => b.total - a.total)

  const vanLabel = delegate.vehicle?.plateNo || delegate.carNumber || '—'

  return (
    <ReportShell
      title={`تقرير المندوب — ${delegate.name}`}
      subtitle={`العربية: ${vanLabel} · المنطقة: ${delegate.area || '—'} · العمولة: ${fmt(Number(delegate.commissionRate))}% · التارجت الأسبوعي: ${target > 0 ? fmt(target) + ' عميل' : 'غير محدد'}`}
      basePath={`/finance/delegates/${delegate.id}`}
      from={fromStr} to={toStr} exportName={`تقرير-${delegate.name}-${fromStr}_${toStr}`}
      exportHeaders={['الجولة', 'التاريخ', 'مباع', 'مرتجع', 'كاش', 'إنستا', 'محفظة', 'إجمالي', 'آجل', 'عمولة']}
      exportRows={delegate.settlements.map((s) => {
        const parts = Number(s.cashOnlyAmount) + Number(s.instapayAmount) + Number(s.walletAmount)
        const cashOnly = parts === 0 ? Number(s.cashAmount) : Number(s.cashOnlyAmount)
        return [
          s.deliveryOrder?.orderNo || '—', new Date(s.createdAt).toLocaleDateString('ar-EG'),
          Number(s.soldQty), Number(s.returnedQty), cashOnly.toFixed(2), Number(s.instapayAmount).toFixed(2),
          Number(s.walletAmount).toFixed(2), Number(s.cashAmount).toFixed(2), Number(s.creditAmount).toFixed(2), Number(s.commission).toFixed(2),
        ]
      })}
      kpis={[
        { label: 'جولات الفترة', value: fmt(delegate.settlements.length), color: 'text-[#0f3460]' },
        { label: 'عملاء متحققين', value: target > 0 ? `${fmt(achievedIds.size)} / ${fmt(target)}` : fmt(achievedIds.size), color: target > 0 && achievedIds.size >= target ? 'text-green-600' : 'text-amber-600' },
        { label: 'محصّل كاش', value: money(S.cashOnly), color: 'text-emerald-600' },
        { label: 'إنستا + محفظة', value: money(S.insta + S.wallet), color: 'text-purple-600' },
        { label: 'إجمالي المحصّل', value: money(S.collected), color: 'text-[#0f3460]' },
        { label: 'العمولة المستحقة', value: money(S.commission), color: 'text-[#e94560]' },
      ]}
    >
      {/* خط السير الأسبوعي الكامل */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden print-area">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <h3 className="text-base font-bold text-[#1a1a2e]">خط السير الأسبوعي الكامل ({fmt(planTotal)} عميل موزّع)</h3>
          <span className="text-xs text-gray-400">اللي عليه ✓ اتعمل له فاتورة خلال الفترة المختارة</span>
        </div>
        {planTotal === 0 ? (
          <p className="p-6 pt-0 text-sm text-gray-400">مفيش خط سير محدد للمندوب ده — بيتحدد من شاشة إدارة المناديب.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 p-5 pt-0">
            {WEEK_DAYS.map(({ day, label }) => {
              const list = planByDay.get(day) || []
              const doneCount = list.filter((e) => achievedIds.has(e.customerId)).length
              return (
                <div key={day} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-sm font-bold text-[#1a1a2e]">{label}</span>
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 tabular-nums ${doneCount === list.length && list.length > 0 ? 'bg-green-50 text-green-700' : 'bg-white border border-gray-200'}`}>
                      {fmt(doneCount)}/{fmt(list.length)}
                    </span>
                  </div>
                  <div className="p-2 space-y-1 min-h-[60px]">
                    {list.map((e) => {
                      const done = achievedIds.has(e.customerId)
                      return (
                        <div key={e.id} className={`text-xs rounded-lg px-2 py-1.5 ${done ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'}`}>
                          {done && '✓ '}{e.customer.name}
                          <span className="text-gray-400"> {[e.customer.area, e.customer.phone].filter(Boolean).join(' · ')}</span>
                        </div>
                      )
                    })}
                    {list.length === 0 && <p className="text-[11px] text-gray-300 text-center pt-3">مفيش عملاء</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <ReportTable
        title="كشف جولات الفترة"
        columns={[
          { header: 'الجولة' }, { header: 'التاريخ', align: 'center' as const },
          { header: 'مباع', align: 'end' as const }, { header: 'مرتجع', align: 'end' as const },
          { header: 'كاش', align: 'end' as const }, { header: 'إنستا باي', align: 'end' as const }, { header: 'محفظة', align: 'end' as const },
          { header: 'إجمالي المحصّل', align: 'end' as const }, { header: 'آجل', align: 'end' as const }, { header: 'عمولة', align: 'end' as const },
        ]}
        rows={roundRows}
        footer={['الإجمالي', '', fmt(S.sold), fmt(S.returned), money(S.cashOnly), money(S.insta), money(S.wallet), money(S.collected), money(S.credit), money(S.commission)]}
        emptyText="مفيش جولات متسوّاة في الفترة دي."
      />

      <ReportTable
        title={`عملاء الفترة المتحققين (${fmt(custRows.length)})`}
        columns={[
          { header: 'العميل' }, { header: 'فواتير', align: 'center' as const },
          { header: 'إجمالي المبيعات', align: 'end' as const }, { header: 'المدفوع', align: 'end' as const }, { header: 'الآجل', align: 'end' as const },
        ]}
        rows={custRows.map((c) => [
          c.name, fmt(c.invoices),
          <span key="t" className="font-bold">{money(c.total)}</span>,
          <span key="p" className="text-green-700">{money(c.paid)}</span>,
          c.total - c.paid > 0 ? <span key="c" className="text-amber-700">{money(c.total - c.paid)}</span> : '—',
        ])}
        emptyText="مفيش عملاء اتحققوا في الفترة دي."
      />

      <ReportTable
        title="أوامر تفريغ الفترة"
        columns={[
          { header: 'رقم الأمر' }, { header: 'التاريخ', align: 'center' as const },
          { header: 'الأصناف' }, { header: 'الحالة', align: 'center' as const },
        ]}
        rows={unloads.map((u) => [
          u.unloadNo,
          new Date(u.createdAt).toLocaleDateString('ar-EG'),
          <div key="items" className="flex flex-wrap gap-1">
            {u.items.map((it, i) => (
              <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded tabular-nums ${it.kind === 'RETURN' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                {it.product.name} {fmt(Number(it.quantity))} {it.product.unit} — {it.kind === 'RETURN' ? 'مرتجع' : 'بواقي'}
              </span>
            ))}
          </div>,
          u.status === 'PENDING'
            ? <span key="s" className="text-amber-600 font-bold text-xs">منتظر المخزن</span>
            : u.status === 'CONFIRMED'
              ? <span key="s" className="text-green-600 text-xs">المخزن استلم ✓</span>
              : <span key="s" className="text-gray-400 text-xs">ملغي</span>,
        ])}
        emptyText="مفيش أوامر تفريغ في الفترة دي."
      />
    </ReportShell>
  )
}
