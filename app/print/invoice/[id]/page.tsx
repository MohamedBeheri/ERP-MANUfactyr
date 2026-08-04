import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function InvoicePrintPage({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams;
  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: { include: { tier: true } },
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
  const soldQty = paidItems.reduce((s, it) => s + Number(it.quantity), 0)
  const bonusQty = bonusItems.reduce((s, it) => s + Number(it.quantity), 0)
  // بونص نقاط الفئة المكتسب على الفاتورة دي (نفس حساب السيرفر)
  const bonusPct = inv.customer.tier ? Number(inv.customer.tier.bonusPercent) : 0
  const pointsEarned = bonusPct > 0 ? +((net * bonusPct) / 100).toFixed(2) : 0
  const hasRewards = bonusQty > 0 || pointsEarned > 0

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
      signatures={['استلمت البضاعة (العميل)', 'المندوب']}
    >
      <PrintTable
        headers={['#', 'الصنف', 'الكمية اللي نزلت', 'سعر الوحدة', 'الإجمالي']}
        rows={inv.items.map((item, i) => [
          i + 1,
          item.isBonus ? `🎁 ${item.product.name} (هدية)` : item.product.name,
          `${Number(item.quantity)} ${item.product.unit}`,
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

      {/* بيان الهدايا والبونص — يظهر دايمًا */}
      <div style={{ marginTop: 12, padding: '10px 14px', background: hasRewards ? '#fffbeb' : '#f9fafb', border: `1px solid ${hasRewards ? '#fde68a' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }}>
        <strong>🎁 الهدايا والبونص:</strong>
        {hasRewards ? (
          <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
            {bonusItems.map((b) => (
              <li key={b.id}>هدية مجانية: {Number(b.quantity)} {b.product.unit} {b.product.name}</li>
            ))}
            {pointsEarned > 0 && (
              <li>بونص نقاط مكتسب: {pointsEarned.toLocaleString('ar-EG')} نقطة (فئة {inv.customer.tier?.name})</li>
            )}
          </ul>
        ) : (
          <span style={{ color: '#6b7280' }}> مفيش هدايا أو بونص على الفاتورة دي.</span>
        )}
      </div>

      {/* ملاحظات الفاتورة */}
      {inv.invoiceNotes && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
          <strong>📝 ملاحظات الفاتورة:</strong> {inv.invoiceNotes}
        </div>
      )}
    </PrintDoc>
  )
}
