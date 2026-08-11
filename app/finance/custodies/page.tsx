import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { money, parsePeriod, dateTime } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'بانتظار الاعتماد',
  APPROVED: 'معتمدة — بانتظار الصرف',
  REJECTED: 'مرفوضة',
  DISBURSED: 'عهدة مفتوحة',
  SETTLED: 'متسوّية',
}
const STATUS_CLS: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-blue-50 text-blue-700',
  REJECTED: 'bg-red-50 text-red-600',
  DISBURSED: 'bg-orange-50 text-orange-700',
  SETTLED: 'bg-green-50 text-green-700',
}

// تقرير عُهد الموظفين المفصّل: صرف/مصروفات معتمدة/مرتجع/قائم في عُهد + تفصيل بنود المصروفات
export default async function CustodiesReport({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const custodies = await prisma.custody.findMany({
    where: { createdAt: period },
    include: {
      user: { select: { name: true, jobTitle: true } },
      paymentMethod: { select: { name: true } },
      treasury: { select: { name: true } },
      returnMethod: { select: { name: true } },
      returnTreasury: { select: { name: true } },
      expenses: { include: { category: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const disbursed = custodies.filter((c) => ['DISBURSED', 'SETTLED'].includes(c.status))
  const totalDisbursed = disbursed.reduce((s, c) => s + Number(c.approvedAmount || 0), 0)
  const totalApprovedExpenses = disbursed.reduce(
    (s, c) => s + c.expenses.filter((e) => e.status === 'APPROVED').reduce((x, e) => x + Number(e.amount), 0),
    0
  )
  const totalReturned = custodies.reduce((s, c) => s + Number(c.returnedAmount || 0), 0)
  const outstanding = custodies
    .filter((c) => c.status === 'DISBURSED')
    .reduce((s, c) => {
      const approved = c.expenses.filter((e) => e.status === 'APPROVED').reduce((x, e) => x + Number(e.amount), 0)
      return s + Number(c.approvedAmount || 0) - approved
    }, 0)

  // تفصيل مصروفات العُهد المعتمدة حسب بند المصروف
  const byCategory = new Map<string, number>()
  for (const c of disbursed) {
    for (const e of c.expenses) {
      if (e.status !== 'APPROVED') continue
      const key = e.category?.name || 'بدون بند'
      byCategory.set(key, (byCategory.get(key) || 0) + Number(e.amount))
    }
  }

  const columns = [
    { header: 'رقم العهدة' }, { header: 'الموظف' }, { header: 'الغرض' },
    { header: 'المبلغ', align: 'end' as const },
    { header: 'وسيلة الصرف' },
    { header: 'مصروفات معتمدة', align: 'end' as const },
    { header: 'مرتجع للخزنة', align: 'end' as const },
    { header: 'قائم في العهدة', align: 'end' as const },
    { header: 'الحالة', align: 'center' as const },
    { header: 'التاريخ' },
  ]

  const rows = custodies.map((c) => {
    const amount = Number(c.approvedAmount ?? c.requestedAmount)
    const approvedExp = c.expenses.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + Number(e.amount), 0)
    const inHand = c.status === 'DISBURSED' ? amount - approvedExp : 0
    return [
      <span key="n" className="font-bold tabular-nums text-xs">{c.custodyNo}</span>,
      <span key="u" className="text-xs">{c.user.name}{c.user.jobTitle ? <span className="text-gray-400"> · {c.user.jobTitle}</span> : null}</span>,
      <span key="p" className="text-xs text-gray-600 max-w-[160px] truncate block">{c.purpose}</span>,
      <span key="a" className="font-bold tabular-nums">{money(amount)}</span>,
      <span key="m" className="text-xs text-gray-500">{c.paymentMethod ? `${c.paymentMethod.name} — ${c.treasury?.name || ''}` : '—'}</span>,
      <span key="e" className="tabular-nums text-red-600">{money(approvedExp)}</span>,
      <span key="r" className="tabular-nums text-green-700">{c.returnedAmount != null ? money(Number(c.returnedAmount)) : '—'}</span>,
      <span key="h" className="tabular-nums text-orange-700 font-bold">{inHand > 0 ? money(inHand) : '—'}</span>,
      <span key="s" className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_CLS[c.status] || ''}`}>{STATUS_LABEL[c.status] || c.status}</span>,
      <span key="d" className="text-xs tabular-nums whitespace-nowrap">{dateTime(c.createdAt)}</span>,
    ]
  })

  const exportRows = custodies.map((c) => {
    const amount = Number(c.approvedAmount ?? c.requestedAmount)
    const approvedExp = c.expenses.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + Number(e.amount), 0)
    return [
      c.custodyNo, c.user.name, c.purpose, amount,
      c.paymentMethod ? `${c.paymentMethod.name} — ${c.treasury?.name || ''}` : '—',
      approvedExp, c.returnedAmount != null ? Number(c.returnedAmount) : '—',
      c.status === 'DISBURSED' ? amount - approvedExp : '—',
      STATUS_LABEL[c.status] || c.status, dateTime(c.createdAt),
    ]
  })

  return (
    <ReportShell
      title="عُهد الموظفين" subtitle="دورة العهدة كاملة: صرف من الخزنة → مصروفات بإثبات → رد المتبقي"
      basePath="/finance/custodies" from={fromStr} to={toStr}
      exportName={`عهد-الموظفين-${fromStr}_${toStr}`}
      exportHeaders={columns.map((c) => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'إجمالي المصروف كعُهد', value: money(totalDisbursed), color: 'text-[#0f3460]' },
        { label: 'مصروفات معتمدة بإثبات', value: money(totalApprovedExpenses), color: 'text-red-600' },
        { label: 'مرتجع للخزائن', value: money(totalReturned), color: 'text-green-600' },
        { label: 'قائم في عُهد (خارج الخزنة)', value: money(outstanding), color: 'text-orange-600' },
      ]}
    >
      <ReportTable title={`العُهد (${custodies.length})`} columns={columns} rows={rows} emptyText="مفيش عُهد في الفترة المحددة" />

      {byCategory.size > 0 && (
        <ReportTable
          title="مصروفات العُهد المعتمدة حسب البند"
          columns={[{ header: 'بند المصروف' }, { header: 'الإجمالي', align: 'end' as const }]}
          rows={Array.from(byCategory.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, total]) => [
              <span key="n" className="text-sm">{name}</span>,
              <span key="t" className="font-bold tabular-nums">{money(total)}</span>,
            ])}
          footer={['الإجمالي', money(totalApprovedExpenses)]}
        />
      )}
    </ReportShell>
  )
}
