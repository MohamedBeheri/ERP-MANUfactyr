import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function DayReportPrintPage({ params: rawParams }: { params: Promise<{ deliveryOrderId: string }> }) {
  const params = await rawParams
  const order = await prisma.deliveryOrder.findUnique({
    where: { id: params.deliveryOrderId },
    include: {
      delegate: true,
      invoices: { include: { customer: true, items: { include: { product: true } } }, orderBy: { createdAt: 'asc' } },
      returns: { include: { customer: true, items: { include: { product: true } } } },
    },
  })
  if (!order) notFound()

  const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`

  // تحصيلات المندوب في نفس يوم الجولة (بالوسائل)
  const dayStart = new Date(order.createdAt); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(order.createdAt); dayEnd.setHours(23, 59, 59, 999)
  const collections = await prisma.collection.findMany({
    where: { delegateId: order.delegateId, createdAt: { gte: dayStart, lte: dayEnd } },
    include: { paymentMethod: true, customer: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // ===== (١) الفواتير: المدفوع + الأصناف المباعة (بدون البونص) =====
  const invoiceRows = order.invoices.map((inv, i) => {
    const paidItems = inv.items.filter((it) => !it.isBonus)
    const desc = paidItems.map((it) => `${it.product.name} ×${Number(it.quantity)}`).join('، ')
    return [
      i + 1, inv.customer.name, desc || '—', egp(Number(inv.netAmount)), egp(Number(inv.paidAmount)),
      inv.collectionMethod === 'تحويل انستا' ? 'إنستا باي' : inv.collectionMethod === 'تحويل محفظة' ? 'محفظة' : inv.type !== 'CASH' ? 'آجل' : 'نقدي',
    ]
  })

  // ===== (٢) البونص المصروف (الهدايا اللي نزلت من العربية) =====
  const bonusMap = new Map<string, { name: string; unit: string; qty: number }>()
  for (const inv of order.invoices)
    for (const it of inv.items.filter((x) => x.isBonus)) {
      const prev = bonusMap.get(it.productId) || { name: it.product.name, unit: it.product.unit, qty: 0 }
      prev.qty += Number(it.quantity); bonusMap.set(it.productId, prev)
    }
  const bonusRows = Array.from(bonusMap.values()).map((b, i) => [i + 1, b.name, `${b.qty} ${b.unit}`])
  const bonusTotal = Array.from(bonusMap.values()).reduce((s, b) => s + b.qty, 0)

  // ===== (٣) المرتجعات — مع تمييز البونص المرتجع =====
  const returnRows = order.returns.map((r, i) => [
    i + 1,
    r.customer?.name || r.customerName || '—',
    r.items.map((it) => `${it.isBonus ? '🎁 ' : ''}${it.product.name} ×${Number(it.quantity)}${it.isBonus ? ' (هدية)' : ''}`).join('، '),
    egp(Number(r.totalValue)),
    r.refundCash ? 'رد نقدي' : 'خصم آجل',
  ])
  const returnsVal = order.returns.reduce((s, r) => s + Number(r.totalValue), 0)
  const bonusReturned = order.returns.flatMap((r) => r.items).filter((it) => it.isBonus).reduce((s, it) => s + Number(it.quantity), 0)

  // ===== إجمالي البيع بالوسائل =====
  const salesCash = order.invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
  const salesInsta = order.invoices.filter((i) => i.collectionMethod === 'تحويل انستا').reduce((s, i) => s + Number(i.paidAmount), 0)
  const salesWallet = order.invoices.filter((i) => i.collectionMethod === 'تحويل محفظة').reduce((s, i) => s + Number(i.paidAmount), 0)
  const salesCashOnly = salesCash - salesInsta - salesWallet
  const credit = order.invoices.reduce((s, i) => s + (Number(i.netAmount) - Number(i.paidAmount)), 0)
  const soldValue = order.invoices.reduce((s, i) => s + Number(i.netAmount), 0)

  // ===== إجمالي التحصيلات بالوسائل =====
  const collByMethod = new Map<string, number>()
  for (const c of collections) collByMethod.set(c.paymentMethod.name, (collByMethod.get(c.paymentMethod.name) || 0) + Number(c.amount))
  const collCash = collections.filter((c) => c.paymentMethod.type !== 'ELECTRONIC').reduce((s, c) => s + Number(c.amount), 0)
  const collElectronic = collections.filter((c) => c.paymentMethod.type === 'ELECTRONIC').reduce((s, c) => s + Number(c.amount), 0)
  const collTotal = collCash + collElectronic

  // الواجب توريده كاش = كاش البيع + كاش التحصيل
  const cashToTreasury = salesCashOnly + collCash

  return (
    <PrintDoc
      title="محضر تسوية اليوم"
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
      {/* ملخص سريع */}
      <PrintTable
        headers={['البيان', 'القيمة']}
        rows={[
          ['إجمالي المباع (قيمة الفواتير)', egp(soldValue)],
          ['عدد الفواتير', String(order.invoices.length)],
          ['البونص المصروف (قطع هدايا)', String(bonusTotal)],
          ['المرتجعات', `${egp(returnsVal)}${bonusReturned > 0 ? ` · منها ${bonusReturned} قطعة بونص` : ''}`],
        ]}
      />

      <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>أولاً: فواتير البيع للعملاء</h3>
      <PrintTable
        headers={['#', 'العميل', 'الأصناف المباعة', 'الإجمالي', 'المدفوع', 'الطريقة']}
        rows={invoiceRows.length ? invoiceRows : [[1, 'لا يوجد', '—', egp(0), egp(0), '—']]}
      />

      {bonusRows.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>ثانياً: البونص المصروف (الهدايا اللي نزلت من العربية)</h3>
          <PrintTable headers={['#', 'الصنف', 'الكمية']} rows={bonusRows} totals={[{ label: 'إجمالي قطع الهدايا', value: String(bonusTotal) }]} />
        </>
      )}

      {returnRows.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>ثالثاً: المرتجعات من العملاء (🎁 = هدية مرتجعة)</h3>
          <PrintTable headers={['#', 'العميل', 'الأصناف', 'القيمة', 'النوع']} rows={returnRows} totals={[{ label: 'إجمالي المرتجعات', value: egp(returnsVal) }]} />
        </>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>رابعاً: إجمالي البيع بالوسائل</h3>
      <PrintTable
        headers={['الوسيلة', 'القيمة']}
        rows={[
          ['بيع كاش', egp(salesCashOnly)],
          ['بيع إنستا باي', egp(salesInsta)],
          ['بيع محفظة', egp(salesWallet)],
          ['بيع آجل (على العملاء)', egp(credit)],
        ]}
        totals={[{ label: 'إجمالي البيع', value: egp(soldValue) }]}
      />

      <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>خامساً: إجمالي التحصيلات بالوسائل (تحصيل من مديونيات سابقة)</h3>
      <PrintTable
        headers={['الوسيلة', 'القيمة']}
        rows={
          collByMethod.size > 0
            ? Array.from(collByMethod.entries()).map(([m, v]) => [m, egp(v)])
            : [['مفيش تحصيلات النهارده', egp(0)]]
        }
        totals={[{ label: 'إجمالي التحصيلات', value: egp(collTotal) }]}
      />

      <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>الواجب توريده للخزنة</h3>
      <PrintTable
        headers={['البيان', 'القيمة']}
        rows={[
          ['كاش (بيع + تحصيل)', egp(cashToTreasury)],
          ['إلكتروني (إنستا/محفظة → الحساب الوسيط)', egp(salesInsta + salesWallet + collElectronic)],
        ]}
        totals={[{ label: 'إجمالي الوارد للخزنة النهارده', value: egp(cashToTreasury + salesInsta + salesWallet + collElectronic) }]}
      />
    </PrintDoc>
  )
}
