import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function DeliveryPrintPage({ params }: { params: { id: string } }) {
  const order = await prisma.deliveryOrder.findUnique({
    where: { id: params.id },
    include: {
      delegate: true,
      items: { include: { product: true } },
      creator: true,
    },
  })
  if (!order) notFound()

  const STATUS: Record<string, string> = {
    PENDING: 'معلّقة',
    IN_PROGRESS: 'جارية',
    COMPLETED: 'مُسوّاة',
    CANCELLED: 'ملغية',
  }

  return (
    <PrintDoc
      title="أمر تحميل عربية"
      docNo={order.orderNo}
      date={order.createdAt}
      meta={[
        { label: 'المندوب', value: order.delegate.name },
        { label: 'رقم العربية', value: order.delegate.carNumber || '—' },
        { label: 'المنطقة', value: order.delegate.area || '—' },
        { label: 'تليفون', value: order.delegate.phone || '—' },
        { label: 'أمر بواسطة', value: order.creator.name },
        { label: 'الحالة', value: STATUS[order.status] || order.status },
      ]}
      footerNote={order.notes ? `ملاحظات: ${order.notes}` : undefined}
      signatures={['المندوب / السائق', 'أمين المخزن', 'مدير المبيعات']}
    >
      <PrintTable
        headers={['#', 'الصنف', 'الكمية المحمّلة', 'الوحدة']}
        rows={order.items.map((item, i) => [i + 1, item.product.name, item.quantity, item.product.unit])}
        totals={[
          { label: 'إجمالي الوحدات المحمّلة', value: `${order.items.reduce((s, i) => s + i.quantity, 0)}` },
        ]}
      />
    </PrintDoc>
  )
}
