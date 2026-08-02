import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

const METHOD_LABELS: Record<string, string> = { CASH: 'نقدي', CHECK: 'شيك', TRANSFER: 'تحويل بنكي' }

export default async function VoucherPrintPage({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const voucher = await prisma.paymentVoucher.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      treasury: true,
      liability: true,
      createdBy: true,
      approvedBy: true,
    },
  })
  if (!voucher) notFound()

  return (
    <PrintDoc
      title="سند صرف"
      docNo={voucher.voucherNo}
      date={voucher.createdAt}
      meta={[
        { label: 'الخزنة', value: voucher.treasury?.name || 'غير محددة' },
        { label: 'بند المصروف', value: voucher.category?.name || '—' },
        { label: 'طريقة الدفع', value: METHOD_LABELS[voucher.paymentMethod] || voucher.paymentMethod },
        { label: 'حرّره', value: voucher.createdBy.name },
        { label: 'اعتمده', value: voucher.approvedBy?.name || '—' },
      ]}
      footerNote={voucher.notes ? `ملاحظات: ${voucher.notes}` : undefined}
      signatures={['المستلم', 'أمين الخزنة', 'المدير المالي']}
    >
      <PrintTable
        headers={['البيان', 'المبلغ']}
        rows={[[voucher.description, `${Number(voucher.amount).toLocaleString('ar-EG')} ج.م`]]}
      />
      <div style={{ marginTop: 16, padding: '10px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 14, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
        <span>إجمالي المنصرف</span>
        <span>{Number(voucher.amount).toLocaleString('ar-EG')} ج.م</span>
      </div>
    </PrintDoc>
  )
}
