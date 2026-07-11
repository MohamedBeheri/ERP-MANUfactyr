import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function InvoicePrintPage({ params }: { params: { id: string } }) {
  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      delegate: true,
      items: { include: { product: true } },
      creator: true,
    },
  })
  if (!inv) notFound()

  return (
    <PrintDoc
      title="فاتورة بيع"
      docNo={inv.invoiceNo}
      date={inv.createdAt}
      meta={[
        { label: 'العميل', value: inv.customer.name },
        { label: 'تليفون', value: inv.customer.phone || '—' },
        { label: 'نوع الدفع', value: inv.type === 'CASH' ? 'نقدي' : 'آجل' },
        ...(inv.delegate ? [{ label: 'المندوب', value: inv.delegate.name }] : []),
        { label: 'البائع', value: inv.creator.name },
      ]}
      signatures={['العميل', 'البائع']}
    >
      <PrintTable
        headers={['#', 'الصنف', 'الكمية', 'سعر الوحدة', 'الإجمالي']}
        rows={inv.items.map((item, i) => [
          i + 1,
          item.product.name,
          item.quantity,
          `${Number(item.unitPrice).toLocaleString('ar-EG')} ج.م`,
          `${Number(item.totalPrice).toLocaleString('ar-EG')} ج.م`,
        ])}
        totals={[
          { label: 'الإجمالي', value: `${Number(inv.totalAmount).toLocaleString('ar-EG')} ج.م` },
          ...(Number(inv.discount) > 0
            ? [{ label: `الخصم (${Number(inv.discount)}%)`, value: `- ${(Number(inv.totalAmount) - Number(inv.netAmount)).toLocaleString('ar-EG')} ج.م` }]
            : []),
          { label: 'الصافي المستحق', value: `${Number(inv.netAmount).toLocaleString('ar-EG')} ج.م` },
        ]}
      />
    </PrintDoc>
  )
}
