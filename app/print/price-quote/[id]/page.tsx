import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function PriceQuotePrintPage({ params }: { params: { id: string } }) {
  const q = await prisma.priceQuote.findUnique({
    where: { id: params.id },
    include: {
      keyAccount: true,
      creator: true,
      items: { include: { product: true } },
    },
  })
  if (!q) notFound()

  const withQty = q.items.some((it) => it.quantity > 0)
  const subtotal = q.items.reduce((s, it) => s + Number(it.unitPrice) * (it.quantity || 0), 0)
  const admin = Number(q.adminExpenses)
  const cashDisc = q.discountType === 'CASH' ? ((subtotal + admin) * Number(q.discountPercent)) / 100 : 0
  const net = subtotal + admin - cashDisc

  const headers = withQty
    ? ['#', 'الصنف', 'الوحدة', 'الكمية', 'سعر الوحدة', 'الإجمالي']
    : ['#', 'الصنف', 'الوحدة', 'سعر التوريد']

  const rows = q.items.map((it, i) =>
    withQty
      ? [
          i + 1,
          it.product.name,
          it.product.unit,
          it.quantity,
          `${Number(it.unitPrice).toLocaleString('ar-EG')} ج.م`,
          `${(Number(it.unitPrice) * (it.quantity || 0)).toLocaleString('ar-EG')} ج.م`,
        ]
      : [i + 1, it.product.name, it.product.unit, `${Number(it.unitPrice).toLocaleString('ar-EG')} ج.م`]
  )

  const totals = withQty
    ? [
        { label: 'إجمالي الأصناف', value: `${subtotal.toLocaleString('ar-EG')} ج.م` },
        ...(admin > 0 ? [{ label: 'مصاريف إدارية', value: `${admin.toLocaleString('ar-EG')} ج.م` }] : []),
        ...(cashDisc > 0 ? [{ label: `خصم نقدي (${Number(q.discountPercent)}%)`, value: `- ${cashDisc.toLocaleString('ar-EG')} ج.م` }] : []),
        { label: 'الصافي', value: `${net.toLocaleString('ar-EG')} ج.م` },
      ]
    : undefined

  return (
    <PrintDoc
      title="بيان سعر توريد"
      docNo={q.quoteNo}
      date={q.createdAt}
      meta={[
        { label: 'العميل', value: q.keyAccount.name },
        ...(q.keyAccount.brandName ? [{ label: 'الماركة', value: q.keyAccount.brandName }] : []),
        ...(q.keyAccount.activityType ? [{ label: 'النشاط', value: q.keyAccount.activityType }] : []),
        { label: 'تليفون', value: q.keyAccount.phone || '—' },
        ...(q.keyAccount.address ? [{ label: 'العنوان', value: q.keyAccount.address }] : []),
        { label: 'الحالة', value: q.status === 'APPROVED' ? 'معتمد' : q.status === 'CANCELLED' ? 'ملغي' : 'مسودة' },
        ...(q.validUntil ? [{ label: 'ساري حتى', value: new Date(q.validUntil).toLocaleDateString('ar-EG') }] : []),
        { label: 'أعدّه', value: q.creator.name },
      ]}
      signatures={['العميل', 'المسؤول']}
    >
      <PrintTable headers={headers} rows={rows} totals={totals} />
      {q.notes && <p style={{ marginTop: 12, fontSize: 12, color: '#444' }}>ملاحظات: {q.notes}</p>}
      {q.discountType === 'CASH' && (
        <p style={{ marginTop: 6, fontSize: 12, color: '#444' }}>
          * الخصم النقدي المذكور يُحسب كمبلغ فعلي (مصر فلوس) عند التوريد وليس نقاط بونص.
        </p>
      )}
    </PrintDoc>
  )
}
