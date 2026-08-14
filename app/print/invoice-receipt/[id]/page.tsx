import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CashierReceipt } from '@/components/cashier-receipt'

export default async function InvoiceReceipt({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { name: true } },
      creator: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
  })
  if (!inv) notFound()

  const payLabel = inv.type === 'CREDIT' ? 'آجل' : (inv.collectionMethod || inv.paymentMethod || 'نقدي')

  return (
    <CashierReceipt
      title="إيصال بيع — كافيه"
      docNo={inv.invoiceNo}
      date={inv.createdAt}
      cashier={inv.creator.name}
      buyer={inv.customer?.name || null}
      paymentMethod={payLabel}
      lines={inv.items.map((it) => ({ name: it.product.name, quantity: Number(it.quantity), unit: it.product.unit, unitPrice: Number(it.unitPrice) }))}
      total={Number(inv.netAmount)}
    />
  )
}
