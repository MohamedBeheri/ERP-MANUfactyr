import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function PurchasePrintPage({ params }: { params: { id: string } }) {
  const pur = await prisma.purchase.findUnique({
    where: { id: params.id },
    include: { supplier: true, items: { include: { product: true } }, creator: true },
  })
  if (!pur) notFound()

  return (
    <PrintDoc
      title="أمر شراء / توريد"
      docNo={pur.invoiceNo}
      date={pur.createdAt}
      meta={[
        { label: 'المورد', value: pur.supplier.name },
        { label: 'تليفون المورد', value: pur.supplier.phone || '—' },
        { label: 'أمر بواسطة', value: pur.creator.name },
      ]}
      footerNote={pur.notes ? `ملاحظات: ${pur.notes}` : undefined}
      signatures={['المورد', 'أمين المخزن', 'المدير المالي']}
    >
      <PrintTable
        headers={['#', 'الصنف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي']}
        rows={pur.items.map((item, i) => [
          i + 1,
          item.product.name,
          item.quantity,
          item.product.unit,
          `${Number(item.unitPrice).toLocaleString('ar-EG')} ج.م`,
          `${Number(item.totalPrice).toLocaleString('ar-EG')} ج.م`,
        ])}
        totals={[
          { label: 'الإجمالي المستحق', value: `${Number(pur.totalAmount).toLocaleString('ar-EG')} ج.م` },
        ]}
      />
    </PrintDoc>
  )
}
