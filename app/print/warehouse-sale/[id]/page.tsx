import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CashierReceipt } from '@/components/cashier-receipt'

export default async function WarehouseSaleReceipt({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const sale = await prisma.warehouseSale.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { name: true } },
      creator: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
  })
  if (!sale) notFound()

  return (
    <CashierReceipt
      title="فاتورة بيع نقدي — مخزن"
      docNo={sale.saleNo}
      date={sale.createdAt}
      cashier={sale.creator.name}
      buyer={`${sale.buyerType === 'TRADER' ? 'تاجر' : 'عميل'}${sale.buyerName ? `: ${sale.buyerName}` : ''}`}
      paymentMethod={sale.paymentMethod}
      lines={sale.items.map((it) => ({ name: it.product.name, quantity: Number(it.quantity), unit: it.product.unit, unitPrice: Number(it.unitPrice) }))}
      total={Number(sale.totalAmount)}
    />
  )
}
