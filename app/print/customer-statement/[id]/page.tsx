import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

const ONLINE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'جديد', CONFIRMED: 'مؤكّد', PREPARING: 'بيتجهّز', SHIPPED: 'خرج للتوصيل', DELIVERED: 'اتسلّم', CANCELLED: 'اتلغى',
}
const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'مسودة', COMPLETED: 'مكتملة', CANCELLED: 'ملغية', REFUNDED: 'مرتجعة',
}

export default async function CustomerStatementPrintPage({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      tier: true,
      invoices: {
        select: {
          invoiceNo: true, netAmount: true, paidAmount: true, type: true,
          paymentMethod: true, collectionMethod: true, status: true, createdAt: true,
          items: { where: { isBonus: false }, select: { quantity: true, product: { select: { name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
      onlineOrders: {
        select: { orderNo: true, total: true, paymentMethod: true, status: true, createdAt: true, items: { select: { quantity: true, productName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!customer) notFound()

  const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`
  const d = (dt: Date) => new Date(dt).toLocaleDateString('ar-EG')

  type Row = {
    date: Date; docNo: string; source: string; items: string; total: number; paid: number | null; remaining: number | null; status: string
  }
  const rows: Row[] = [
    ...customer.invoices.map((i) => {
      const total = Number(i.netAmount)
      const paid = Number(i.paidAmount)
      const remaining = Math.max(0, total - paid)
      const status = i.status !== 'COMPLETED' ? INVOICE_STATUS_LABEL[i.status] : (remaining <= 0 ? 'مدفوعة بالكامل' : paid > 0 ? 'مدفوعة جزئيًا' : 'غير مدفوعة (آجل)')
      return {
        date: i.createdAt, docNo: i.invoiceNo, source: 'محل',
        items: i.items.map((it) => `${it.product.name} ×${Number(it.quantity)}`).join('، ') || '—',
        total, paid, remaining, status,
      }
    }),
    ...customer.onlineOrders.map((o) => ({
      date: o.createdAt, docNo: o.orderNo, source: 'أونلاين',
      items: o.items.map((it) => `${it.productName} ×${Number(it.quantity)}`).join('، ') || '—',
      total: Number(o.total), paid: null, remaining: null,
      status: ONLINE_STATUS_LABEL[o.status] || o.status,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const tableRows = rows.length
    ? rows.map((r, i) => [
        i + 1, d(r.date), r.source, r.docNo, r.items, egp(r.total),
        r.paid != null ? egp(r.paid) : '—',
        r.remaining != null && r.remaining > 0 ? egp(r.remaining) : '—',
        r.status,
      ])
    : [[1, d(new Date()), '—', '—', 'لا توجد طلبات', '—', '—', '—', '—']]

  const totalOrders = rows.reduce((s, r) => s + r.total, 0)
  const totalPaid = rows.reduce((s, r) => s + (r.paid || 0), 0)

  return (
    <PrintDoc
      title="كشف حساب عميل"
      docNo={customer.name}
      date={new Date()}
      meta={[
        { label: 'العميل', value: customer.name },
        { label: 'النوع', value: customer.tier?.name || (customer.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي') },
        { label: 'تليفون', value: customer.phone || '—' },
        ...(customer.governorate || customer.area ? [{ label: 'المنطقة', value: [customer.governorate, customer.area].filter(Boolean).join(' — ') }] : []),
        ...(customer.address ? [{ label: 'العنوان', value: customer.address }] : []),
        { label: 'عدد الطلبات', value: String(rows.length) },
        { label: 'رصيد البونص', value: `${Number(customer.bonusPoints).toLocaleString('ar-EG')} نقطة` },
        { label: 'عميل من', value: d(customer.createdAt) },
      ]}
      signatures={['العميل', 'المسؤول']}
    >
      <PrintTable
        headers={['#', 'التاريخ', 'المصدر', 'رقم المستند', 'الأصناف', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة']}
        rows={tableRows}
        totals={[
          { label: 'إجمالي الطلبات', value: egp(totalOrders) },
          { label: 'إجمالي المدفوع', value: egp(totalPaid) },
          { label: 'الرصيد المستحق (مديونية)', value: egp(Number(customer.balance)) },
        ]}
      />
    </PrintDoc>
  )
}
