import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

const PAY_STATUS: Record<string, string> = {
  UNPAID: 'غير مدفوعة',
  PARTIAL: 'مدفوعة جزئيًا',
  PAID: 'مدفوعة بالكامل',
}
const money = (n: number) => `${Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`

export default async function PurchasePrintPage({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const pur = await prisma.purchase.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      items: { include: { product: true } },
      creator: true,
      vouchers: {
        include: {
          createdBy: { select: { name: true } },
          lines: { include: { paymentMethod: true, treasury: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!pur) notFound()

  const total = Number(pur.totalAmount)
  const paid = Number(pur.paidAmount)
  const remaining = Math.max(0, total - paid)

  return (
    <PrintDoc
      title="فاتورة شراء / توريد"
      docNo={pur.invoiceNo}
      date={pur.createdAt}
      meta={[
        { label: 'المورد', value: pur.supplier.name },
        { label: 'تليفون المورد', value: pur.supplier.phone || '—' },
        { label: 'عنوان المورد', value: pur.supplier.address || '—' },
        { label: 'رقم فاتورة المورد', value: pur.supplierInvoiceNo || '—' },
        { label: 'حالة الدفع', value: PAY_STATUS[pur.paymentStatus] || pur.paymentStatus },
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
          Number(item.quantity),
          item.product.unit,
          money(Number(item.unitPrice)),
          money(Number(item.totalPrice)),
        ])}
        totals={[
          { label: 'إجمالي الفاتورة', value: money(total) },
          { label: 'المدفوع للمورد', value: money(paid) },
          { label: 'المتبقّي (مستحق للمورد)', value: money(remaining) },
        ]}
      />

      {/* ===== تفاصيل الدفع (سندات الصرف للمورد) ===== */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-[#1a1a2e] mb-2 border-b border-gray-300 pb-1">تفاصيل الدفع</h3>
        {pur.vouchers.length === 0 ? (
          <p className="text-sm text-gray-500">لم يتم سداد أي مبلغ لهذه الفاتورة حتى الآن — كامل المبلغ ({money(total)}) مستحق للمورد.</p>
        ) : (
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-[#1a1a2e] text-white">
                <th className="p-2.5 text-right font-semibold border-l border-gray-600">سند</th>
                <th className="p-2.5 text-right font-semibold border-l border-gray-600">التاريخ</th>
                <th className="p-2.5 text-right font-semibold border-l border-gray-600">طريقة الدفع</th>
                <th className="p-2.5 text-right font-semibold border-l border-gray-600">الخزنة</th>
                <th className="p-2.5 text-right font-semibold border-l border-gray-600">مرجع التحويل</th>
                <th className="p-2.5 text-right font-semibold">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {pur.vouchers.flatMap((v) =>
                v.lines.map((ln, j) => (
                  <tr key={ln.id} className="bg-white">
                    <td className="p-2.5 border-t border-l border-gray-200 tabular-nums">{j === 0 ? v.voucherNo : ''}</td>
                    <td className="p-2.5 border-t border-l border-gray-200 tabular-nums">{new Date(v.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td className="p-2.5 border-t border-l border-gray-200">{ln.paymentMethod.name}</td>
                    <td className="p-2.5 border-t border-l border-gray-200">{ln.treasury.name}</td>
                    <td className="p-2.5 border-t border-l border-gray-200 tabular-nums">{ln.transactionReference || '—'}</td>
                    <td className="p-2.5 border-t border-gray-200 tabular-nums font-semibold">{money(Number(ln.amount))}</td>
                  </tr>
                ))
              )}
              <tr className="bg-gray-50 font-bold">
                <td className="p-2.5 border-t border-gray-300" colSpan={5}>إجمالي المدفوع</td>
                <td className="p-2.5 border-t border-gray-300 tabular-nums">{money(paid)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ===== مرفق إيصال المورد ===== */}
      {pur.invoiceImage && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-[#1a1a2e] mb-2 border-b border-gray-300 pb-1">إيصال / فاتورة المورد المرفقة</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pur.invoiceImage} alt="فاتورة المورد" className="max-w-full max-h-[600px] mx-auto border border-gray-300 rounded" />
        </div>
      )}
    </PrintDoc>
  )
}
