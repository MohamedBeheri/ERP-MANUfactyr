import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function SettlementPrintPage({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams;
  const settlement = await prisma.settlement.findUnique({
    where: { id: params.id },
    include: {
      delegate: true,
      creator: true,
      deliveryOrder: {
        include: {
          items: { include: { product: true } },
          invoices: { include: { customer: true, items: { include: { product: true } } }, orderBy: { createdAt: 'asc' } },
          returns: { include: { customer: true, items: { include: { product: true } } }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!settlement) notFound()

  const order = settlement.deliveryOrder

  // تفصيل كل صنف: محمّل / مباع / باقي على العربية (بواقي بيع) / مرتجع من عميل بفاتورة سابقة
  const itemBreakdown = order
    ? order.items.map((item) => {
        const loaded = Number(item.quantity)
        const delivered = order.invoices
          .flatMap((inv) => inv.items)
          .filter((it) => it.productId === item.productId)
          .reduce((s, it) => s + Number(it.quantity), 0)
        const customerReturn = order.returns
          .flatMap((r) => r.items)
          .filter((it) => it.productId === item.productId)
          .reduce((s, it) => s + Number(it.quantity), 0)
        const leftover = Math.max(0, loaded - delivered)
        return {
          name: item.product.name,
          unit: item.product.unit,
          loaded,
          delivered,
          leftover,
          customerReturn,
        }
      }).filter((r) => r.loaded > 0 || r.customerReturn > 0)
    : []

  return (
    <PrintDoc
      title="محضر تسوية عربية"
      docNo={order?.orderNo || settlement.id.slice(-8)}
      date={settlement.createdAt}
      meta={[
        { label: 'المندوب', value: settlement.delegate.name },
        { label: 'رقم العربية', value: settlement.delegate.carNumber || '—' },
        { label: 'المباع', value: `${Number(settlement.soldQty)} وحدة` },
        { label: 'المرتجع', value: `${Number(settlement.returnedQty)} وحدة` },
        { label: 'تمت بواسطة', value: settlement.creator.name },
      ]}
      footerNote={settlement.notes ? `ملاحظات: ${settlement.notes}` : undefined}
      signatures={['المندوب', 'المحاسب', 'المدير العام']}
    >
      {order && order.invoices.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">تسليمات الجولة ({order.invoices.length})</h4>
          <PrintTable
            headers={['#', 'العميل', 'رقم الفاتورة', 'النوع', 'المبلغ']}
            rows={order.invoices.map((inv, i) => [
              i + 1,
              inv.customer.name,
              inv.invoiceNo,
              inv.type !== 'CASH' ? 'آجل' : inv.collectionMethod === 'تحويل انستا' ? 'إنستا باي' : inv.collectionMethod === 'تحويل محفظة' ? 'محفظة' : 'نقدي',
              `${Number(inv.netAmount).toLocaleString('ar-EG')} ج.م`,
            ])}
          />
        </div>
      )}

      {itemBreakdown.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">تفصيل الأصناف — محمّل / مباع / باقي على العربية / مرتجع من عميل</h4>
          <PrintTable
            headers={['الصنف', 'محمّل', 'مباع', 'باقي على العربية (بواقي)', 'مرتجع عميل (فاتورة سابقة)']}
            rows={itemBreakdown.map((r) => [
              `${r.name} (${r.unit})`,
              r.loaded,
              r.delivered,
              r.leftover,
              r.customerReturn,
            ])}
          />
        </div>
      )}

      {order && order.returns.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">تفاصيل المرتجعات من العملاء ({order.returns.length})</h4>
          <PrintTable
            headers={['#', 'العميل', 'رقم المرتجع', 'الأصناف', 'طريقة الرد', 'القيمة']}
            rows={order.returns.map((r, i) => [
              i + 1,
              r.customer?.name || r.customerName || 'عميل',
              r.returnNo,
              r.items.map((it) => `${it.product.name} ×${Number(it.quantity)}`).join('، '),
              r.refundCash ? 'رد نقدي' : 'خصم آجل',
              `${Number(r.totalValue).toLocaleString('ar-EG')} ج.م`,
            ])}
          />
        </div>
      )}

      {/* بيان أصناف كل فاتورة */}
      {order && order.invoices.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">بيان أصناف الفواتير</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {order.invoices.map((inv, i) => (
              <div key={inv.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f9fafb', padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{i + 1}. {inv.customer.name} — {inv.invoiceNo}</span>
                  <span>{inv.type !== 'CASH' ? 'آجل' : inv.collectionMethod === 'تحويل انستا' ? 'إنستا باي' : inv.collectionMethod === 'تحويل محفظة' ? 'محفظة' : 'نقدي'} · {Number(inv.netAmount).toLocaleString('ar-EG')} ج.م</span>
                </div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#6b7280', textAlign: 'right' }}>
                      <th style={{ padding: '4px 12px', fontWeight: 500 }}>الصنف</th>
                      <th style={{ padding: '4px 12px', fontWeight: 500 }}>الكمية</th>
                      <th style={{ padding: '4px 12px', fontWeight: 500 }}>سعر الوحدة</th>
                      <th style={{ padding: '4px 12px', fontWeight: 500 }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.items.map((it) => (
                      <tr key={it.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '4px 12px' }}>{it.isBonus ? `🎁 ${it.product.name} (هدية)` : it.product.name}</td>
                        <td style={{ padding: '4px 12px' }}>{Number(it.quantity)} {it.product.unit}</td>
                        <td style={{ padding: '4px 12px' }}>{it.isBonus ? 'هدية' : `${Number(it.unitPrice).toLocaleString('ar-EG')} ج.م`}</td>
                        <td style={{ padding: '4px 12px' }}>{it.isBonus ? '—' : `${Number(it.totalPrice).toLocaleString('ar-EG')} ج.م`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
      <PrintTable
        headers={['البيان', 'القيمة']}
        rows={[
          ['محصّل كاش', `${(Number(settlement.cashOnlyAmount) + Number(settlement.instapayAmount) + Number(settlement.walletAmount) === 0 ? Number(settlement.cashAmount) : Number(settlement.cashOnlyAmount)).toLocaleString('ar-EG')} ج.م`],
          ['محصّل إنستا باي', `${Number(settlement.instapayAmount).toLocaleString('ar-EG')} ج.م`],
          ['محصّل محفظة', `${Number(settlement.walletAmount).toLocaleString('ar-EG')} ج.م`],
          ['إجمالي المحصّل (كل الوسائل)', `${Number(settlement.cashAmount).toLocaleString('ar-EG')} ج.م`],
          ['آجل (مديونية عملاء)', `${Number(settlement.creditAmount).toLocaleString('ar-EG')} ج.م`],
          ['عمولة المندوب المستحقة', `${Number(settlement.commission).toLocaleString('ar-EG')} ج.م`],
        ]}
        totals={[
          {
            label: 'إجمالي مبيعات الجولة',
            value: `${(Number(settlement.cashAmount) + Number(settlement.creditAmount)).toLocaleString('ar-EG')} ج.م`,
          },
        ]}
      />
    </PrintDoc>
  )
}
