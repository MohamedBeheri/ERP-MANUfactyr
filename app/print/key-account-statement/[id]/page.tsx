import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function KeyAccountStatementPrintPage({ params }: { params: { id: string } }) {
  const acc = await prisma.keyAccount.findUnique({
    where: { id: params.id },
    include: {
      supplies: { include: { branch: true } },
      payments: true,
    },
  })
  if (!acc) notFound()

  const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`
  const d = (dt: Date) => new Date(dt).toLocaleDateString('ar-EG')

  // دمج التوريدات (مدين) والتحصيلات (دائن) في كشف زمني برصيد جارٍ
  type Row = { date: Date; label: string; debit: number; credit: number }
  const entries: Row[] = [
    ...acc.supplies.map((s) => ({
      date: s.createdAt,
      label: `توريد ${s.supplyNo} — فرع ${s.branch.name}`,
      debit: Number(s.netAmount),
      credit: 0,
    })),
    ...acc.payments.map((p) => ({
      date: p.createdAt,
      label: `تحصيل ${p.receiptNo || ''} (${p.method})`,
      debit: 0,
      credit: Number(p.amount),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  let running = 0
  const rows = entries.map((e, i) => {
    running += e.debit - e.credit
    return [
      i + 1,
      d(e.date),
      e.label,
      e.debit > 0 ? egp(e.debit) : '—',
      e.credit > 0 ? egp(e.credit) : '—',
      egp(running),
    ]
  })

  const totalSupplies = acc.supplies.reduce((s, x) => s + Number(x.netAmount), 0)
  const totalPayments = acc.payments.reduce((s, x) => s + Number(x.amount), 0)

  return (
    <PrintDoc
      title="كشف حساب عميل"
      docNo={acc.name}
      date={new Date()}
      meta={[
        { label: 'العميل', value: acc.name },
        ...(acc.brandName ? [{ label: 'الماركة', value: acc.brandName }] : []),
        ...(acc.activityType ? [{ label: 'النشاط', value: acc.activityType }] : []),
        { label: 'تليفون', value: acc.phone || '—' },
        ...(acc.address ? [{ label: 'العنوان', value: acc.address }] : []),
        { label: 'عدد التوريدات', value: String(acc.supplies.length) },
        { label: 'عدد التحصيلات', value: String(acc.payments.length) },
      ]}
      signatures={['العميل', 'المسؤول']}
    >
      <PrintTable
        headers={['#', 'التاريخ', 'البيان', 'مدين (توريد)', 'دائن (تحصيل)', 'الرصيد']}
        rows={rows.length ? rows : [[1, d(new Date()), 'لا توجد حركات', '—', '—', egp(0)]]}
        totals={[
          { label: 'إجمالي التوريدات', value: egp(totalSupplies) },
          { label: 'إجمالي التحصيلات', value: egp(totalPayments) },
          { label: 'الرصيد المستحق (مطالبات)', value: egp(Number(acc.balance)) },
        ]}
      />
    </PrintDoc>
  )
}
