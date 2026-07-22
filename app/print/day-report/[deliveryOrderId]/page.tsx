import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function DayReportPrintPage({ params }: { params: { deliveryOrderId: string } }) {
  const order = await prisma.deliveryOrder.findUnique({
    where: { id: params.deliveryOrderId },
    include: {
      delegate: true,
      invoices: {
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'asc' },
      },
      keyAccountSupplies: { include: { branch: true, keyAccount: true, items: { include: { product: true } } } },
      returns: { include: { customer: true, items: { include: { product: true } } } },
    },
  })
  if (!order) notFound()

  const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`

  // بنود الفواتير: المدفوع + الأصناف المباعة (بدون البونص)
  const invoiceRows = order.invoices.map((inv, i) => {
    const paidItems = inv.items.filter((it) => !it.isBonus)
    const desc = paidItems.map((it) => `${it.product.name} ×${it.quantity}`).join('، ')
    return [
      i + 1,
      inv.customer.name,
      desc || '—',
      egp(Number(inv.netAmount)),
      egp(Number(inv.paidAmount)),
      inv.paymentMethod,
      inv.invoiceNotes || '—',
    ]
  })

  // الهدايا (بونص) المجمّعة
  const bonusMap = new Map<string, { name: string; unit: string; qty: number }>()
  for (const inv of order.invoices) {
    for (const it of inv.items.filter((x) => x.isBonus)) {
      const prev = bonusMap.get(it.productId) || { name: it.product.name, unit: it.product.unit, qty: 0 }
      prev.qty += it.quantity
      bonusMap.set(it.productId, prev)
    }
  }
  const bonusRows = Array.from(bonusMap.values()).map((b, i) => [i + 1, b.name, `${b.qty} ${b.unit}`])
  const bonusTotal = Array.from(bonusMap.values()).reduce((s, b) => s + b.qty, 0)

  // المرتجعات من العملاء
  const returnRows = order.returns.map((r, i) => [
    i + 1,
    r.customer?.name || r.customerName || '—',
    r.items.map((it) => `${it.product.name} ×${it.quantity}`).join('، '),
    egp(Number(r.totalValue)),
    r.refundCash ? 'رد نقدي' : 'خصم آجل',
  ])

  // كبار الموردين
  const supplyRows = order.keyAccountSupplies.map((s, i) => [
    i + 1,
    `${s.keyAccount.name} — ${s.branch.name}`,
    s.items.reduce((a, it) => a + it.quantity, 0),
    egp(Number(s.netAmount)),
  ])

  const cash = order.invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
  const credit = order.invoices.reduce((s, i) => s + (Number(i.netAmount) - Number(i.paidAmount)), 0)
  const keyCredit = order.keyAccountSupplies.reduce((s, i) => s + Number(i.netAmount), 0)
  const returnsVal = order.returns.reduce((s, r) => s + Number(r.totalValue), 0)
  const soldValue = order.invoices.reduce((s, i) => s + Number(i.netAmount), 0)

  return (
    <PrintDoc
      title="محضر يومي للعربية"
      docNo={order.orderNo}
      date={order.createdAt}
      meta={[
        { label: 'المندوب', value: order.delegate.name },
        { label: 'العربية', value: order.delegate.carNumber || '—' },
        ...(order.delegate.area || order.delegate.route ? [{ label: 'خط السير', value: order.delegate.area || order.delegate.route || '—' }] : []),
        { label: 'عدد الفواتير', value: String(order.invoices.length) },
      ]}
      signatures={['المندوب', 'أمين الخزينة']}
    >
      <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '4px 0 8px' }}>أولاً: فواتير البيع للعملاء</h3>
      <PrintTable
        headers={['#', 'العميل', 'الأصناف المباعة', 'الإجمالي', 'المدفوع', 'الطريقة', 'ملاحظات']}
        rows={invoiceRows.length ? invoiceRows : [[1, 'لا يوجد', '—', egp(0), egp(0), '—', '—']]}
      />

      {bonusRows.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>ثانياً: الهدايا (بونص) اللي نزلت من العربية</h3>
          <PrintTable
            headers={['#', 'الصنف', 'الكمية']}
            rows={bonusRows}
            totals={[{ label: 'إجمالي قطع الهدايا', value: String(bonusTotal) }]}
          />
        </>
      )}

      {supplyRows.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>توريدات كبار الموردين (مطالبات آجلة)</h3>
          <PrintTable headers={['#', 'العميل/الفرع', 'القطع', 'صافي المطالبة']} rows={supplyRows} />
        </>
      )}

      {returnRows.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>ثالثاً: المرتجعات من العملاء</h3>
          <PrintTable
            headers={['#', 'العميل', 'الأصناف', 'القيمة', 'النوع']}
            rows={returnRows}
            totals={[{ label: 'إجمالي المرتجعات', value: egp(returnsVal) }]}
          />
        </>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>الملخص المالي لليوم</h3>
      <PrintTable
        headers={['البيان', 'القيمة']}
        rows={[
          ['إجمالي مبيعات العملاء', egp(soldValue)],
          ['المحصّل نقدي', egp(cash)],
          ['آجل على العملاء', egp(credit)],
          ['مطالبات كبار الموردين (آجل)', egp(keyCredit)],
          ['مرتجعات من العملاء', egp(returnsVal)],
          ['عدد قطع الهدايا (بونص)', String(bonusTotal)],
        ]}
        totals={[{ label: 'الواجب توريده للخزينة (نقدي)', value: egp(cash) }]}
      />
    </PrintDoc>
  )
}
