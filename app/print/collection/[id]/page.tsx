import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CashierReceipt } from '@/components/cashier-receipt'

// فاتورة/إيصال تحصيل — للطباعة على ورق كاشير 80مم
export default async function CollectionReceipt({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const col = await prisma.collection.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { name: true, balance: true } },
      delegate: { select: { name: true } },
      paymentMethod: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  })
  if (!col) notFound()

  const method = col.transactionReference ? `${col.paymentMethod.name} — مرجع ${col.transactionReference}` : col.paymentMethod.name

  return (
    <CashierReceipt
      title="إيصال تحصيل"
      docNo={col.collectionNo}
      date={col.createdAt}
      cashier={col.delegate?.name || col.createdBy.name}
      buyer={col.customer.name}
      paymentMethod={method}
      totalLabel="المبلغ المحصّل"
      total={Number(col.amount)}
      lines={[{ name: 'تحصيل دفعة من العميل', quantity: 1, unitPrice: Number(col.amount) }]}
      footer={`الرصيد المتبقي على العميل: ${Number(col.customer.balance).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`}
    />
  )
}
