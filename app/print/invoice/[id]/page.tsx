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

  const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`
  const paid = Number(inv.paidAmount)
  const net = Number(inv.netAmount)
  const remaining = Math.max(0, net - paid)
  const paidItems = inv.items.filter((it) => !it.isBonus)
  const bonusItems = inv.items.filter((it) => it.isBonus)
  const soldQty = paidItems.reduce((s, it) => s + it.quantity, 0)
  const bonusQty = bonusItems.reduce((s, it) => s + it.quantity, 0)

  return (
    <PrintDoc
      title="فاتورة بيع"
      docNo={inv.invoiceNo}
      date={inv.createdAt}
      meta={[
        { label: 'العميل', value: inv.customer.name },
        { label: 'نوع العميل', value: inv.customer.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي' },
        { label: 'تليفون', value: inv.customer.phone || '—' },
        ...(inv.customer.address ? [{ label: 'العنوان', value: inv.customer.address }] : []),
        { label: 'طريقة الدفع', value: inv.paymentMethod },
        ...(inv.collectionMethod ? [{ label: 'طريقة الاستلام', value: inv.collectionMethod }] : []),
        ...(inv.delegate ? [{ label: 'المندوب', value: inv.delegate.name }] : []),
        { label: 'المسجّل', value: inv.creator.name },
      ]}
      footerNote={inv.invoiceNotes || undefined}
      signatures={['استلمت البضاعة (العميل)', 'المندوب']}
    >
      <PrintTable
        headers={['#', 'الصنف', 'الكمية اللي نزلت', 'سعر الوحدة', 'الإجمالي']}
        rows={inv.items.map((item, i) => [
          i + 1,
          item.isBonus ? `🎁 ${item.product.name} (هدية)` : item.product.name,
          `${item.quantity} ${item.product.unit}`,
          item.isBonus ? 'هدية' : egp(Number(item.unitPrice)),
          item.isBonus ? '—' : egp(Number(item.totalPrice)),
        ])}
        totals={[
          { label: `الأصناف المدفوعة (${soldQty} وحدة)`, value: egp(Number(inv.totalAmount)) },
          ...(bonusQty > 0 ? [{ label: `🎁 هدايا مجانية (${bonusQty} وحدة)`, value: 'مجانًا' }] : []),
          ...(Number(inv.discount) > 0
            ? [{ label: `الخصم (${Number(inv.discount)}%)`, value: `- ${egp(Number(inv.totalAmount) - net)}` }]
            : []),
          { label: 'الصافي', value: egp(net) },
          { label: 'المدفوع', value: egp(paid) },
          { label: remaining > 0 ? 'المتبقي على العميل (آجل)' : 'خالص بالكامل', value: egp(remaining) },
        ]}
      />

      {bonusQty > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13 }}>
          <strong>🎁 الهدايا والبونص:</strong> العميل استلم{' '}
          {bonusItems.map((b, i) => (
            <span key={b.id}>{i > 0 ? ' + ' : ' '}{b.quantity} {b.product.unit} {b.product.name}</span>
          ))}{' '}مجانًا مع الفاتورة دي.
        </div>
      )}
    </PrintDoc>
  )
}
