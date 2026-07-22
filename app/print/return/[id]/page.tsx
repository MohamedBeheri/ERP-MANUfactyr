import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function ReturnPrintPage({ params }: { params: { id: string } }) {
  const r = await prisma.deliveryReturn.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      deliveryOrder: { include: { delegate: true } },
      creator: true,
      items: { include: { product: true } },
    },
  })
  if (!r) notFound()

  const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`

  return (
    <PrintDoc
      title="إشعار مرتجع"
      docNo={r.returnNo}
      date={r.createdAt}
      meta={[
        { label: 'العميل', value: r.customer?.name || r.customerName || '—' },
        ...(r.deliveryOrder ? [{ label: 'أمر الجولة', value: r.deliveryOrder.orderNo }] : []),
        ...(r.deliveryOrder?.delegate ? [{ label: 'المندوب', value: r.deliveryOrder.delegate.name }] : []),
        { label: 'نوع التسوية', value: r.refundCash ? 'رد نقدي' : 'خصم من الآجل' },
        ...(r.reason ? [{ label: 'السبب', value: r.reason }] : []),
        { label: 'أعدّه', value: r.creator.name },
      ]}
      signatures={['العميل', 'المندوب']}
    >
      <PrintTable
        headers={['#', 'الصنف', 'الوحدة', 'الكمية', 'سعر الوحدة', 'الإجمالي']}
        rows={r.items.map((it, i) => [
          i + 1,
          it.product.name,
          it.product.unit,
          it.quantity,
          egp(Number(it.unitPrice)),
          egp(Number(it.totalPrice)),
        ])}
        totals={[{ label: 'إجمالي قيمة المرتجع', value: egp(Number(r.totalValue)) }]}
      />
      {r.notes && <p style={{ marginTop: 12, fontSize: 12, color: '#444' }}>ملاحظات: {r.notes}</p>}
      <p style={{ marginTop: 6, fontSize: 12, color: '#444' }}>
        * {r.refundCash ? 'تم رد قيمة المرتجع نقدًا للعميل.' : 'تم خصم قيمة المرتجع من رصيد العميل الآجل.'} البضاعة رجعت للعربية.
      </p>
    </PrintDoc>
  )
}
