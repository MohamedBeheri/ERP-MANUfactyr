import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

// المستحقات لحظية (كل الأرصدة المفتوحة) — لا تتقيّد بالفترة
export default async function ReceivablesReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr } = parsePeriod(searchParams)

  const [customers, keyAccounts, suppliers] = await Promise.all([
    prisma.customer.findMany({ where: { isActive: true, balance: { gt: 0 } }, orderBy: { balance: 'desc' }, select: { name: true, phone: true, balance: true, creditLimit: true } }),
    prisma.keyAccount.findMany({ where: { isActive: true, balance: { gt: 0 } }, orderBy: { balance: 'desc' }, select: { name: true, brandName: true, balance: true } }),
    prisma.supplier.findMany({ where: { isActive: true, balance: { gt: 0 } }, orderBy: { balance: 'desc' }, select: { name: true, phone: true, balance: true } }),
  ])

  const custDebt = customers.reduce((s, c) => s + Number(c.balance), 0)
  const kaDebt = keyAccounts.reduce((s, k) => s + Number(k.balance), 0)
  const supDebt = suppliers.reduce((s, x) => s + Number(x.balance), 0)
  const dueToUs = custDebt + kaDebt

  const custCols = [{ header: 'العميل' }, { header: 'الهاتف', align: 'center' as const }, { header: 'الحد الائتماني', align: 'end' as const }, { header: 'الرصيد المدين', align: 'end' as const }]
  const custRows = customers.map((c) => [c.name, c.phone || '—', money(Number(c.creditLimit)), <span key="b" className="font-bold text-amber-600">{money(Number(c.balance))}</span>])

  const kaCols = [{ header: 'العميل' }, { header: 'الماركة' }, { header: 'المطالبات المستحقة', align: 'end' as const }]
  const kaRows = keyAccounts.map((k) => [k.name, k.brandName || '—', <span key="b" className="font-bold text-amber-600">{money(Number(k.balance))}</span>])

  const supCols = [{ header: 'المورد' }, { header: 'الهاتف', align: 'center' as const }, { header: 'المستحق عليه', align: 'end' as const }]
  const supRows = suppliers.map((x) => [x.name, x.phone || '—', <span key="b" className="font-bold text-red-600">{money(Number(x.balance))}</span>])

  const exportRows = [
    ['— عملاء مدينون —', '', ''],
    ...customers.map((c) => [c.name, c.phone || '—', Number(c.balance).toFixed(2)]),
    ['— كبار موردين (مطالبات) —', '', ''],
    ...keyAccounts.map((k) => [k.name, k.brandName || '—', Number(k.balance).toFixed(2)]),
    ['— مستحق للموردين —', '', ''],
    ...suppliers.map((x) => [x.name, x.phone || '—', Number(x.balance).toFixed(2)]),
  ]

  return (
    <ReportShell
      title="المستحقات والآجل" subtitle="أرصدة لحظية — مستحق لنا من العملاء وكبار الموردين، ومستحق علينا للموردين" basePath="/finance/receivables"
      from={fromStr} to={toStr} exportName={`المستحقات-${fromStr}_${toStr}`}
      exportHeaders={['الطرف', 'الهاتف/الماركة', 'الرصيد']} exportRows={exportRows}
      kpis={[
        { label: 'مستحق لنا (الإجمالي)', value: money(dueToUs), color: 'text-amber-600' },
        { label: 'ديون العملاء', value: money(custDebt), color: 'text-amber-600' },
        { label: 'مطالبات كبار الموردين', value: money(kaDebt), color: 'text-amber-600' },
        { label: 'مستحق علينا للموردين', value: money(supDebt), color: 'text-red-600' },
      ]}
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ReportTable title={`عملاء مدينون (${money(custDebt)})`} columns={custCols} rows={custRows} emptyText="لا توجد ديون على العملاء 🎉" />
        <ReportTable title={`كبار موردين — مطالبات (${money(kaDebt)})`} columns={kaCols} rows={kaRows} emptyText="لا توجد مطالبات قائمة" />
      </div>
      <ReportTable title={`مستحق للموردين (${money(supDebt)})`} columns={supCols} rows={supRows} emptyText="لا يوجد مستحق للموردين" />
    </ReportShell>
  )
}
