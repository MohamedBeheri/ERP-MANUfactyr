import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'
import { ensureTreasuries } from '@/lib/treasuries'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  MAIN_CASH: 'الخزنة العمومية',
  SALESMAN_CASH: 'خزنة مندوب',
  CLEARING_ACCOUNT: 'حساب وسيط (تحت التسوية)',
  BANK: 'حساب بنكي',
}

// تقرير الخزائن والتحصيلات: أرصدة كل خزنة + حركات الفترة + سندات التحصيل بالوسيلة + تحويلات تحت التسوية
export default async function TreasuriesReport({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  await ensureTreasuries()

  const [treasuries, txns, collections, unsettled] = await Promise.all([
    prisma.treasury.findMany({
      where: { isActive: true },
      include: { delegate: { select: { name: true } } },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.treasuryTransaction.findMany({
      where: { createdAt: period },
      include: { treasury: { select: { id: true, name: true } } },
    }),
    prisma.collection.findMany({
      where: { createdAt: period },
      include: { paymentMethod: true, customer: { select: { name: true } }, treasury: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.collection.findMany({
      where: { isSettled: false, paymentMethod: { type: 'ELECTRONIC' } },
      include: { paymentMethod: true, customer: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // حركات الفترة مجمّعة لكل خزنة
  const flowByTreasury = new Map<string, { in: number; out: number }>()
  for (const t of txns) {
    const prev = flowByTreasury.get(t.treasury.id) || { in: 0, out: 0 }
    if (t.type === 'IN') prev.in += Number(t.amount)
    else prev.out += Number(t.amount)
    flowByTreasury.set(t.treasury.id, prev)
  }

  const treasuryRows = treasuries.map((t) => {
    const flow = flowByTreasury.get(t.id) || { in: 0, out: 0 }
    return {
      name: t.name,
      type: TYPE_LABEL[t.type] || t.type,
      balance: Number(t.balance),
      inflow: flow.in,
      outflow: flow.out,
      allowExpense: t.allowExpenseDisbursement,
    }
  })
  const totalBalances = treasuryRows.reduce((s, t) => s + t.balance, 0)
  const totalIn = treasuryRows.reduce((s, t) => s + t.inflow, 0)
  const totalOut = treasuryRows.reduce((s, t) => s + t.outflow, 0)

  // سندات التحصيل بالوسيلة
  const byMethod = new Map<string, { name: string; type: string; count: number; total: number }>()
  for (const c of collections) {
    const prev = byMethod.get(c.paymentMethod.id) || { name: c.paymentMethod.name, type: c.paymentMethod.type, count: 0, total: 0 }
    prev.count += 1
    prev.total += Number(c.amount)
    byMethod.set(c.paymentMethod.id, prev)
  }
  const methodRows = Array.from(byMethod.values()).sort((a, b) => b.total - a.total)
  const totalCollections = methodRows.reduce((s, m) => s + m.total, 0)

  const unsettledTotal = unsettled.reduce((s, c) => s + Number(c.amount), 0)
  const clearingBalance = treasuryRows.find((t) => t.type === TYPE_LABEL.CLEARING_ACCOUNT)?.balance || 0
  const bankBalance = treasuryRows.filter((t) => t.type === TYPE_LABEL.BANK).reduce((s, t) => s + t.balance, 0)
  const mainBalance = treasuryRows.filter((t) => t.type === TYPE_LABEL.MAIN_CASH).reduce((s, t) => s + t.balance, 0)

  return (
    <ReportShell
      title="الخزائن والتحصيلات" subtitle="أرصدة الخزائن وحركاتها · سندات التحصيل بالوسيلة · تحويلات إنستا باي تحت التسوية" basePath="/finance/treasuries"
      from={fromStr} to={toStr} exportName={`الخزائن-والتحصيلات-${fromStr}_${toStr}`}
      exportHeaders={['الخزنة', 'النوع', 'وارد الفترة', 'منصرف الفترة', 'الرصيد الحالي']}
      exportRows={treasuryRows.map((t) => [t.name, t.type, t.inflow.toFixed(2), t.outflow.toFixed(2), t.balance.toFixed(2)])}
      kpis={[
        { label: 'إجمالي أرصدة الخزائن', value: money(totalBalances), color: 'text-[#0f3460]' },
        { label: 'الخزنة العمومية', value: money(mainBalance), color: 'text-emerald-600' },
        { label: 'تحت التسوية (غير متطابق)', value: money(unsettledTotal), color: 'text-purple-600' },
        { label: 'بالبنك', value: money(bankBalance), color: 'text-teal-600' },
        { label: 'تحصيلات الفترة', value: money(totalCollections), color: 'text-amber-600' },
      ]}
    >
      <ReportTable
        title="أرصدة الخزائن وحركة الفترة"
        columns={[
          { header: 'الخزنة' }, { header: 'النوع' },
          { header: 'وارد الفترة', align: 'end' as const }, { header: 'منصرف الفترة', align: 'end' as const },
          { header: 'الرصيد الحالي', align: 'end' as const }, { header: 'الصرف منها', align: 'center' as const },
        ]}
        rows={treasuryRows.map((t) => [
          t.name, t.type,
          <span key="i" className="text-green-600">{t.inflow > 0 ? `+${money(t.inflow)}` : '—'}</span>,
          <span key="o" className="text-red-600">{t.outflow > 0 ? `-${money(t.outflow)}` : '—'}</span>,
          <span key="b" className="font-bold">{money(t.balance)}</span>,
          t.allowExpense ? <span key="e" className="text-green-600 text-xs">مسموح ✓</span> : <span key="e" className="text-gray-400 text-xs">موقوف</span>,
        ])}
        footer={['الإجمالي', '', money(totalIn), money(totalOut), money(totalBalances), '']}
      />

      <ReportTable
        title="سندات التحصيل خلال الفترة — بالوسيلة"
        columns={[
          { header: 'وسيلة الدفع' }, { header: 'عدد السندات', align: 'center' as const },
          { header: 'الإجمالي', align: 'end' as const }, { header: 'نسبة', align: 'end' as const },
        ]}
        rows={methodRows.map((m) => [
          <span key="n" className={m.type === 'ELECTRONIC' ? 'text-purple-700 font-semibold' : m.type === 'BANK' ? 'text-teal-700 font-semibold' : 'font-semibold'}>{m.name}</span>,
          fmt(m.count),
          <span key="t" className="font-bold">{money(m.total)}</span>,
          totalCollections > 0 ? `${((m.total / totalCollections) * 100).toFixed(1)}%` : '—',
        ])}
        footer={['الإجمالي', fmt(collections.length), money(totalCollections), '']}
        emptyText="مفيش سندات تحصيل في الفترة دي."
      />

      <ReportTable
        title={`تحويلات إنستا باي/محافظ لسه ما اتطابقتش مع البنك (${fmt(unsettled.length)})`}
        columns={[
          { header: 'رقم السند' }, { header: 'الرقم المرجعي' }, { header: 'العميل' },
          { header: 'المبلغ', align: 'end' as const }, { header: 'التاريخ', align: 'center' as const },
        ]}
        rows={unsettled.map((c) => [
          c.collectionNo,
          <span key="r" className="font-mono text-xs text-purple-700">{c.transactionReference || '—'}</span>,
          c.customer.name,
          <span key="a" className="font-bold">{money(Number(c.amount))}</span>,
          new Date(c.createdAt).toLocaleDateString('ar-EG'),
        ])}
        footer={['الإجمالي', '', '', money(unsettledTotal), '']}
        emptyText="كل التحويلات الإلكترونية متطابقة مع البنك ✓"
      />
    </ReportShell>
  )
}
