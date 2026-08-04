import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function ReturnPrintPage({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams;
  const r = await prisma.deliveryReturn.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      deliveryOrder: { include: { delegate: true } },
      invoice: { include: { items: { include: { product: true } } } },
      creator: true,
      items: { include: { product: true } },
    },
  })
  if (!r) notFound()

  const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`

  return (
    <PrintDoc
      title="إشعار مرتجع بفاتورة"
      docNo={r.returnNo}
      date={r.createdAt}
      meta={[
        { label: 'العميل', value: r.customer?.name || r.customerName || '—' },
        ...(r.invoice ? [{ label: 'مرتجع من فاتورة', value: r.invoice.invoiceNo }] : []),
        ...(r.deliveryOrder?.delegate ? [{ label: 'المندوب', value: r.deliveryOrder.delegate.name }] : []),
        { label: 'نوع التسوية', value: r.refundCash ? 'رد نقدي' : 'خصم من الآجل' },
        ...(r.reason ? [{ label: 'السبب', value: r.reason }] : []),
        { label: 'أعدّه', value: r.creator.name },
      ]}
      signatures={['العميل', 'المندوب']}
    >
      {/* بنود الفاتورة الأصلية */}
      {r.invoice && (
        <div style={{ marginBottom: 20 }}>
          <h4 className="font-bold text-sm mb-2">بنود الفاتورة الأصلية — {r.invoice.invoiceNo}</h4>
          <PrintTable
            headers={['#', 'الصنف', 'الكمية', 'سعر الوحدة', 'الإجمالي']}
            rows={r.invoice.items.map((it, i) => [
              i + 1,
              it.isBonus ? `🎁 ${it.product.name} (هدية)` : it.product.name,
              `${Number(it.quantity)} ${it.product.unit}`,
              it.isBonus ? 'هدية' : egp(Number(it.unitPrice)),
              it.isBonus ? '—' : egp(Number(it.totalPrice)),
            ])}
          />
        </div>
      )}

      <h4 className="font-bold text-sm mb-2">المرتجع</h4>
      <PrintTable
        headers={['#', 'الصنف', 'الوحدة', 'الكمية', 'سعر الوحدة', 'الإجمالي']}
        rows={r.items.map((it, i) => [
          i + 1,
          it.isBonus ? `🎁 ${it.product.name} (هدية)` : it.product.name,
          it.product.unit,
          Number(it.quantity),
          it.isBonus ? 'هدية' : egp(Number(it.unitPrice)),
          it.isBonus ? '—' : egp(Number(it.totalPrice)),
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
