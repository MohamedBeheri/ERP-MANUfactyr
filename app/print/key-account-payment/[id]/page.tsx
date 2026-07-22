import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function PaymentReceiptPrintPage({ params }: { params: { id: string } }) {
  const p = await prisma.keyAccountPayment.findUnique({
    where: { id: params.id },
    include: { keyAccount: true, creator: true },
  })
  if (!p) notFound()

  const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`

  return (
    <PrintDoc
      title="إيصال تحصيل"
      docNo={p.receiptNo || p.id.slice(-6)}
      date={p.createdAt}
      meta={[
        { label: 'العميل', value: p.keyAccount.name },
        ...(p.keyAccount.brandName ? [{ label: 'الماركة', value: p.keyAccount.brandName }] : []),
        { label: 'تليفون', value: p.keyAccount.phone || '—' },
        { label: 'طريقة التحصيل', value: p.method },
        { label: 'المستلم', value: p.creator.name },
      ]}
      signatures={['العميل', 'المُحصِّل']}
    >
      <PrintTable
        headers={['البيان', 'القيمة']}
        rows={[
          ['المطالبات قبل التحصيل', egp(Number(p.balanceBefore))],
          ['المبلغ المحصَّل', egp(Number(p.amount))],
          ['المتبقي بعد التحصيل', egp(Number(p.balanceAfter))],
        ]}
        totals={[{ label: 'المبلغ المحصَّل', value: egp(Number(p.amount)) }]}
      />
      {p.notes && <p style={{ marginTop: 12, fontSize: 12, color: '#444' }}>ملاحظات: {p.notes}</p>}
      <p style={{ marginTop: 10, fontSize: 12, color: '#444' }}>
        استلمنا من السيد/ {p.keyAccount.name} مبلغ {egp(Number(p.amount))} فقط لا غير، خصمًا من مطالباته المستحقة.
      </p>
    </PrintDoc>
  )
}
