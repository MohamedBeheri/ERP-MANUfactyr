import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function SupplyPrintPage({ params }: { params: { id: string } }) {
  const s = await prisma.keyAccountSupply.findUnique({
    where: { id: params.id },
    include: {
      keyAccount: true,
      branch: true,
      delegate: true,
      deliveryOrder: true,
      creator: true,
      items: { include: { product: true } },
    },
  })
  if (!s) notFound()

  const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`
  const cashDisc = Number(s.totalAmount) - Number(s.netAmount)

  return (
    <PrintDoc
      title="إذن توريد لفرع"
      docNo={s.supplyNo}
      date={s.createdAt}
      meta={[
        { label: 'العميل (المقر)', value: s.keyAccount.name },
        { label: 'الفرع', value: s.branch.name },
        ...(s.branch.address ? [{ label: 'عنوان الفرع', value: s.branch.address }] : []),
        ...(s.delegate ? [{ label: 'المندوب', value: s.delegate.name }] : []),
        ...(s.deliveryOrder ? [{ label: 'أمر الجولة', value: s.deliveryOrder.orderNo }] : []),
        { label: 'أعدّه', value: s.creator.name },
      ]}
      signatures={['مستلم الفرع', 'المندوب']}
    >
      <PrintTable
        headers={['#', 'الصنف', 'الوحدة', 'الكمية', 'سعر الوحدة', 'الإجمالي']}
        rows={s.items.map((it, i) => [
          i + 1,
          it.product.name,
          it.product.unit,
          it.quantity,
          egp(Number(it.unitPrice)),
          egp(Number(it.totalPrice)),
        ])}
        totals={[
          { label: 'الإجمالي', value: egp(Number(s.totalAmount)) },
          ...(cashDisc > 0 ? [{ label: `خصم نقدي (${Number(s.discountPercent)}%)`, value: `- ${egp(cashDisc)}` }] : []),
          { label: 'صافي المطالبة على المقر', value: egp(Number(s.netAmount)) },
        ]}
      />
      {s.notes && <p style={{ marginTop: 12, fontSize: 12, color: '#444' }}>ملاحظات: {s.notes}</p>}
      <p style={{ marginTop: 6, fontSize: 12, color: '#444' }}>
        * صافي هذا التوريد يُضاف إلى مطالبات المقر الرئيسي ({s.keyAccount.name}).
      </p>
    </PrintDoc>
  )
}
