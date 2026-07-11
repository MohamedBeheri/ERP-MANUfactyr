import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function SettlementPrintPage({ params }: { params: { id: string } }) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: params.id },
    include: {
      delegate: true,
      creator: true,
      deliveryOrder: {
        include: {
          items: { include: { product: true } },
          invoices: { include: { customer: true } },
        },
      },
    },
  })
  if (!settlement) notFound()

  const order = settlement.deliveryOrder

  return (
    <PrintDoc
      title="محضر تسوية عربية"
      docNo={order?.orderNo || settlement.id.slice(-8)}
      date={settlement.createdAt}
      meta={[
        { label: 'المندوب', value: settlement.delegate.name },
        { label: 'رقم العربية', value: settlement.delegate.carNumber || '—' },
        { label: 'المباع', value: `${settlement.soldQty} وحدة` },
        { label: 'المرتجع', value: `${settlement.returnedQty} وحدة` },
        { label: 'تمت بواسطة', value: settlement.creator.name },
      ]}
      footerNote={settlement.notes ? `ملاحظات: ${settlement.notes}` : undefined}
      signatures={['المندوب', 'المحاسب', 'المدير العام']}
    >
      {order && order.invoices.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">تسليمات الجولة ({order.invoices.length})</h4>
          <PrintTable
            headers={['#', 'العميل', 'رقم الفاتورة', 'النوع', 'المبلغ']}
            rows={order.invoices.map((inv, i) => [
              i + 1,
              inv.customer.name,
              inv.invoiceNo,
              inv.type === 'CASH' ? 'نقدي' : 'آجل',
              `${Number(inv.netAmount).toLocaleString('ar-EG')} ج.م`,
            ])}
          />
        </div>
      )}
      <PrintTable
        headers={['البيان', 'القيمة']}
        rows={[
          ['محصّل نقدي', `${Number(settlement.cashAmount).toLocaleString('ar-EG')} ج.م`],
          ['آجل (مديونية عملاء)', `${Number(settlement.creditAmount).toLocaleString('ar-EG')} ج.م`],
          ['عمولة المندوب المستحقة', `${Number(settlement.commission).toLocaleString('ar-EG')} ج.م`],
        ]}
        totals={[
          {
            label: 'إجمالي مبيعات الجولة',
            value: `${(Number(settlement.cashAmount) + Number(settlement.creditAmount)).toLocaleString('ar-EG')} ج.م`,
          },
        ]}
      />
    </PrintDoc>
  )
}
