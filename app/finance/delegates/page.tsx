import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

// تقرير المناديب المفصّل: تحصيل بالوسيلة (كاش/إنستا/محفظة) + تارجت وتحقيق + تفريغات
export default async function DelegatesReport({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const [delegates, periodInvoices, unloads] = await Promise.all([
    prisma.delegate.findMany({
      where: { isActive: true },
      include: {
        vehicle: { select: { plateNo: true } },
        settlements: {
          where: { createdAt: period },
          select: { soldQty: true, bonusQty: true, returnedQty: true, cashAmount: true, cashOnlyAmount: true, instapayAmount: true, walletAmount: true, creditAmount: true, commission: true },
        },
        _count: { select: { invoices: { where: { status: 'COMPLETED', createdAt: period } } } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.invoice.findMany({
      where: { delegateId: { not: null }, createdAt: period },
      select: { delegateId: true, customerId: true },
    }),
    prisma.unloadOrder.findMany({
      where: { createdAt: period },
      include: { delegate: { select: { id: true, name: true } }, items: true },
    }),
  ])

  // عملاء الفترة المتحققين (distinct) لكل مندوب — أساس متابعة التارجت
  const customersByDelegate = new Map<string, Set<string>>()
  for (const inv of periodInvoices) {
    if (!inv.delegateId) continue
    if (!customersByDelegate.has(inv.delegateId)) customersByDelegate.set(inv.delegateId, new Set())
    customersByDelegate.get(inv.delegateId)!.add(inv.customerId)
  }

  const stat = delegates.map((d) => {
    const sold = d.settlements.reduce((s, x) => s + Number(x.soldQty), 0)
    const bonus = d.settlements.reduce((s, x) => s + Number(x.bonusQty), 0)
    const returned = d.settlements.reduce((s, x) => s + Number(x.returnedQty), 0)
    const collected = d.settlements.reduce((s, x) => s + Number(x.cashAmount), 0)
    const insta = d.settlements.reduce((s, x) => s + Number(x.instapayAmount), 0)
    const wallet = d.settlements.reduce((s, x) => s + Number(x.walletAmount), 0)
    // الـ fallback لكل تسوية على حدة: القديمة بدون تفصيل بيتحسب إجماليها كاش
    const cashOnly = d.settlements.reduce((s, x) => {
      const parts = Number(x.cashOnlyAmount) + Number(x.instapayAmount) + Number(x.walletAmount)
      return s + (parts === 0 ? Number(x.cashAmount) : Number(x.cashOnlyAmount))
    }, 0)
    const credit = d.settlements.reduce((s, x) => s + Number(x.creditAmount), 0)
    const commission = d.settlements.reduce((s, x) => s + Number(x.commission), 0)
    const target = Number(d.weeklyCustomerTarget)
    const achieved = customersByDelegate.get(d.id)?.size || 0
    return {
      id: d.id,
      name: d.name, plate: d.vehicle?.plateNo || d.carNumber || '—',
      rounds: d.settlements.length, invoices: d._count.invoices,
      sold, bonus, returned, cashOnly, insta, wallet, collected, credit, commission,
      target, achieved,
    }
  })

  const T = stat.reduce(
    (a, s) => ({
      cashOnly: a.cashOnly + s.cashOnly, insta: a.insta + s.insta, wallet: a.wallet + s.wallet,
      collected: a.collected + s.collected, credit: a.credit + s.credit, commission: a.commission + s.commission, sold: a.sold + s.sold,
    }),
    { cashOnly: 0, insta: 0, wallet: 0, collected: 0, credit: 0, commission: 0, sold: 0 }
  )

  const columns = [
    { header: 'المندوب' }, { header: 'العربية', align: 'center' as const },
    { header: 'جولات', align: 'center' as const }, { header: 'فواتير', align: 'center' as const },
    { header: 'مباع', align: 'end' as const }, { header: 'مرتجع', align: 'end' as const },
    { header: 'كاش', align: 'end' as const }, { header: 'إنستا باي', align: 'end' as const }, { header: 'محفظة', align: 'end' as const },
    { header: 'إجمالي المحصّل', align: 'end' as const }, { header: 'آجل', align: 'end' as const },
    { header: 'عمولة', align: 'end' as const }, { header: 'تارجت/متحقق', align: 'center' as const },
  ]
  const rows = stat.map((s) => [
    <Link key="n" href={`/finance/delegates/${s.id}?from=${fromStr}&to=${toStr}`} className="font-semibold text-[#0f3460] hover:underline">
      {s.name} ←
    </Link>,
    s.plate, fmt(s.rounds), fmt(s.invoices), fmt(s.sold), fmt(s.returned),
    money(s.cashOnly),
    <span key="i" className="text-purple-700">{money(s.insta)}</span>,
    <span key="w" className="text-blue-700">{money(s.wallet)}</span>,
    <span key="t" className="font-bold">{money(s.collected)}</span>,
    money(s.credit),
    <span key="c" className="font-bold text-[#e94560]">{money(s.commission)}</span>,
    s.target > 0 ? (
      <span key="g" className={`font-bold tabular-nums ${s.achieved >= s.target ? 'text-green-600' : 'text-amber-600'}`}>
        {fmt(s.achieved)} / {fmt(s.target)} عميل
      </span>
    ) : <span key="g" className="text-gray-400">{fmt(s.achieved)} عميل</span>,
  ])
  const exportRows = stat.map((s) => [
    s.name, s.plate, s.rounds, s.invoices, s.sold, s.returned,
    s.cashOnly.toFixed(2), s.insta.toFixed(2), s.wallet.toFixed(2), s.collected.toFixed(2),
    s.credit.toFixed(2), s.commission.toFixed(2), s.target > 0 ? `${s.achieved}/${s.target}` : String(s.achieved),
  ])

  // أوامر التفريغ خلال الفترة (مرتجع عميل / بواقي بيع)
  const unloadStat = new Map<string, { name: string; orders: number; returnQty: number; leftoverQty: number; pending: number }>()
  for (const u of unloads) {
    const prev = unloadStat.get(u.delegate.id) || { name: u.delegate.name, orders: 0, returnQty: 0, leftoverQty: 0, pending: 0 }
    prev.orders += 1
    if (u.status === 'PENDING') prev.pending += 1
    for (const it of u.items) {
      if (it.kind === 'RETURN') prev.returnQty += Number(it.quantity)
      else prev.leftoverQty += Number(it.quantity)
    }
    unloadStat.set(u.delegate.id, prev)
  }
  const unloadRows = Array.from(unloadStat.values()).map((u) => [
    u.name, fmt(u.orders),
    <span key="r" className="text-orange-700">{fmt(u.returnQty)}</span>,
    <span key="l" className="text-blue-700">{fmt(u.leftoverQty)}</span>,
    fmt(u.returnQty + u.leftoverQty),
    u.pending > 0 ? <span key="p" className="text-amber-600 font-bold">{fmt(u.pending)} معلّق</span> : <span key="p" className="text-green-600">كله مستلم ✓</span>,
  ])

  return (
    <ReportShell
      title="أداء المناديب" subtitle="تحصيل مفصّل بالوسيلة · تارجت العملاء والتحقيق · تفريغات العربيات" basePath="/finance/delegates"
      from={fromStr} to={toStr} exportName={`أداء-المناديب-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'محصّل كاش', value: money(T.cashOnly), color: 'text-emerald-600' },
        { label: 'محصّل إنستا باي', value: money(T.insta), color: 'text-purple-600' },
        { label: 'محصّل محفظة', value: money(T.wallet), color: 'text-blue-600' },
        { label: 'إجمالي المحصّل', value: money(T.collected), color: 'text-[#0f3460]' },
        { label: 'الآجل', value: money(T.credit), color: 'text-amber-600' },
        { label: 'العمولات', value: money(T.commission), color: 'text-[#e94560]' },
      ]}
    >
      <ReportTable title="المناديب — التحصيل والتارجت" columns={columns} rows={rows}
        footer={['الإجمالي', '', '', '', fmt(T.sold), '', money(T.cashOnly), money(T.insta), money(T.wallet), money(T.collected), money(T.credit), money(T.commission), '']} />

      {unloadRows.length > 0 && (
        <ReportTable
          title="تفريغات العربيات خلال الفترة"
          columns={[
            { header: 'المندوب' }, { header: 'أوامر تفريغ', align: 'center' as const },
            { header: 'مرتجع عملاء', align: 'end' as const }, { header: 'بواقي بيع', align: 'end' as const },
            { header: 'إجمالي راجع', align: 'end' as const }, { header: 'الحالة', align: 'center' as const },
          ]}
          rows={unloadRows}
        />
      )}
    </ReportShell>
  )
}
