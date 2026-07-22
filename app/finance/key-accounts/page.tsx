import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function KeyAccountsReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const accounts = await prisma.keyAccount.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { branches: true } },
      supplies: { where: { createdAt: period }, select: { netAmount: true } },
      payments: { where: { createdAt: period }, select: { amount: true } },
    },
    orderBy: { totalPurchases: 'desc' },
  })

  const stat = accounts.map((a) => ({
    name: a.name,
    brand: a.brandName || '—',
    branches: a._count.branches,
    periodSupplies: a.supplies.reduce((s, x) => s + Number(x.netAmount), 0),
    periodCollected: a.payments.reduce((s, x) => s + Number(x.amount), 0),
    balance: Number(a.balance),
  }))

  const totalSupplies = stat.reduce((s, a) => s + a.periodSupplies, 0)
  const totalCollected = stat.reduce((s, a) => s + a.periodCollected, 0)
  const totalBalance = stat.reduce((s, a) => s + a.balance, 0)

  const columns = [
    { header: 'العميل' }, { header: 'الماركة' }, { header: 'الفروع', align: 'center' as const },
    { header: 'توريدات الفترة', align: 'end' as const }, { header: 'محصّل الفترة', align: 'end' as const }, { header: 'الرصيد المستحق', align: 'end' as const },
  ]
  const rows = stat.map((a) => [
    <span key="n" className="font-semibold">{a.name}</span>, a.brand, fmt(a.branches),
    money(a.periodSupplies), <span key="c" className="text-emerald-600 font-semibold">{money(a.periodCollected)}</span>,
    <span key="b" className={a.balance > 0 ? 'font-bold text-amber-600' : 'text-gray-400'}>{money(a.balance)}</span>,
  ])
  const exportRows = stat.map((a) => [a.name, a.brand, a.branches, a.periodSupplies.toFixed(2), a.periodCollected.toFixed(2), a.balance.toFixed(2)])

  return (
    <ReportShell
      title="كشف كبار الموردين" subtitle="توريدات ومحصّل الفترة والرصيد المستحق على المقر الرئيسي" basePath="/finance/key-accounts"
      from={fromStr} to={toStr} exportName={`كشف-كبار-الموردين-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'عدد العملاء', value: fmt(stat.length), color: 'text-[#0f3460]' },
        { label: 'توريدات الفترة', value: money(totalSupplies), color: 'text-green-600' },
        { label: 'محصّل الفترة', value: money(totalCollected), color: 'text-emerald-600' },
        { label: 'إجمالي المستحق', value: money(totalBalance), color: 'text-amber-600' },
      ]}
    >
      <ReportTable title="كبار الموردين" columns={columns} rows={rows}
        footer={['الإجمالي', '', '', money(totalSupplies), money(totalCollected), money(totalBalance)]} />
    </ReportShell>
  )
}
