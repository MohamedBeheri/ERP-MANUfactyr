import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod } from '@/lib/report-utils'
import { getCafeStageIds } from '@/lib/cafe'

export const dynamic = 'force-dynamic'

// تقرير الكافيه: مبيعات المشروبات/الديزرت + استهلاك الخامات بالتوليفات + مشتريات ورصيد مخزن الكافيه
export default async function CafeReport({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const { warehouseId, materialsStageId, itemsStageId } = await getCafeStageIds()

  const [soldItems, consumption, purchases, materials] = await Promise.all([
    // مبيعات أصناف الكافيه في الفترة
    prisma.invoiceItem.findMany({
      where: {
        invoice: { createdAt: period, status: 'COMPLETED' },
        product: { itemKind: 'CAFE_ITEM' },
      },
      include: { product: { select: { id: true, name: true, unit: true } } },
    }),
    // استهلاك الخامات بالتوليفات (إذون صرف الاستهلاك)
    prisma.warehouseOut.findMany({
      where: { reason: 'استهلاك توليفة كافيه', createdAt: period },
      include: { product: { select: { id: true, name: true, unit: true, costPrice: true } } },
    }),
    // مشتريات خامات الكافيه في الفترة
    prisma.purchaseItem.findMany({
      where: {
        purchase: { createdAt: period },
        product: { itemKind: 'CAFE_MATERIAL' },
      },
      include: { product: { select: { id: true, name: true, unit: true } }, purchase: { select: { invoiceNo: true, createdAt: true } } },
    }),
    // رصيد مخزن الكافيه حاليًا
    prisma.product.findMany({
      where: { stageId: materialsStageId, isActive: true },
      include: { stocks: { where: { warehouseId } }, category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  // مبيعات الأصناف مجمّعة
  const salesByItem = new Map<string, { name: string; unit: string; qty: number; bonusQty: number; revenue: number }>()
  for (const it of soldItems) {
    const prev = salesByItem.get(it.product.id) || { name: it.product.name, unit: it.product.unit, qty: 0, bonusQty: 0, revenue: 0 }
    if (it.isBonus) prev.bonusQty += Number(it.quantity)
    else {
      prev.qty += Number(it.quantity)
      prev.revenue += Number(it.totalPrice)
    }
    salesByItem.set(it.product.id, prev)
  }
  const salesRows = Array.from(salesByItem.values()).sort((a, b) => b.revenue - a.revenue)
  const totalRevenue = salesRows.reduce((s, r) => s + r.revenue, 0)
  const totalSoldQty = salesRows.reduce((s, r) => s + r.qty, 0)

  // استهلاك الخامات مجمّع بتكلفته
  const consByMat = new Map<string, { name: string; unit: string; qty: number; cost: number }>()
  for (const c of consumption) {
    const prev = consByMat.get(c.product.id) || { name: c.product.name, unit: c.product.unit, qty: 0, cost: 0 }
    prev.qty += Number(c.quantity)
    prev.cost += Number(c.quantity) * Number(c.product.costPrice)
    consByMat.set(c.product.id, prev)
  }
  const consRows = Array.from(consByMat.values()).sort((a, b) => b.cost - a.cost)
  const totalConsCost = consRows.reduce((s, r) => s + r.cost, 0)

  // المشتريات مجمّعة
  const purByMat = new Map<string, { name: string; unit: string; qty: number; value: number }>()
  for (const p of purchases) {
    const prev = purByMat.get(p.product.id) || { name: p.product.name, unit: p.product.unit, qty: 0, value: 0 }
    prev.qty += Number(p.quantity)
    prev.value += Number(p.totalPrice)
    purByMat.set(p.product.id, prev)
  }
  const purRows = Array.from(purByMat.values()).sort((a, b) => b.value - a.value)
  const totalPurchases = purRows.reduce((s, r) => s + r.value, 0)

  // رصيد الخامات حاليًا
  const stockRows = materials.map((m) => {
    const qty = Number(m.stocks[0]?.quantity ?? 0)
    return { name: m.name, category: m.category?.name || '—', unit: m.unit, qty, value: qty * Number(m.costPrice), low: qty <= Number(m.minStock) }
  })
  const stockValue = stockRows.reduce((s, r) => s + r.value, 0)

  const grossProfit = totalRevenue - totalConsCost

  return (
    <ReportShell
      title="تقرير الكافيه" subtitle="مبيعات المشروبات والديزرت · استهلاك الخامات بالتوليفات · مشتريات ورصيد مخزن الكافيه" basePath="/finance/cafe"
      from={fromStr} to={toStr} exportName={`تقرير-الكافيه-${fromStr}_${toStr}`}
      exportHeaders={['الصنف', 'الكمية', 'هدايا', 'الإيراد']}
      exportRows={salesRows.map((r) => [r.name, r.qty, r.bonusQty, r.revenue.toFixed(2)])}
      kpis={[
        { label: 'إيراد مبيعات الكافيه', value: money(totalRevenue), color: 'text-emerald-600' },
        { label: 'تكلفة الخامات المستهلكة', value: money(totalConsCost), color: 'text-red-600' },
        { label: 'مجمل ربح الكافيه', value: money(grossProfit), color: grossProfit >= 0 ? 'text-[#0f3460]' : 'text-red-600' },
        { label: 'مشتريات خامات الفترة', value: money(totalPurchases), color: 'text-amber-600' },
        { label: 'قيمة رصيد مخزن الكافيه', value: money(stockValue), color: 'text-teal-600' },
      ]}
    >
      <ReportTable
        title={`مبيعات أصناف الكافيه (${fmt(totalSoldQty)} وحدة)`}
        columns={[
          { header: 'الصنف' }, { header: 'الكمية المباعة', align: 'end' as const },
          { header: 'هدايا', align: 'end' as const }, { header: 'الإيراد', align: 'end' as const },
          { header: 'نسبة من الإيراد', align: 'end' as const },
        ]}
        rows={salesRows.map((r) => [
          r.name, `${fmt(r.qty)} ${r.unit}`, r.bonusQty > 0 ? fmt(r.bonusQty) : '—',
          <span key="v" className="font-bold">{money(r.revenue)}</span>,
          totalRevenue > 0 ? `${((r.revenue / totalRevenue) * 100).toFixed(1)}%` : '—',
        ])}
        footer={['الإجمالي', fmt(totalSoldQty), '', money(totalRevenue), '']}
        emptyText="مفيش مبيعات كافيه في الفترة دي."
      />

      <ReportTable
        title="استهلاك الخامات بالتوليفات"
        columns={[
          { header: 'الخامة' }, { header: 'الكمية المستهلكة', align: 'end' as const },
          { header: 'التكلفة', align: 'end' as const },
        ]}
        rows={consRows.map((r) => [r.name, `${fmt(r.qty)} ${r.unit}`, <span key="c" className="text-red-600 font-semibold">{money(r.cost)}</span>])}
        footer={['الإجمالي', '', money(totalConsCost)]}
        emptyText="مفيش استهلاك خامات في الفترة دي."
      />

      <ReportTable
        title="مشتريات خامات الكافيه خلال الفترة"
        columns={[
          { header: 'الخامة' }, { header: 'الكمية المشتراة', align: 'end' as const },
          { header: 'القيمة', align: 'end' as const },
        ]}
        rows={purRows.map((r) => [r.name, `${fmt(r.qty)} ${r.unit}`, money(r.value)])}
        footer={['الإجمالي', '', money(totalPurchases)]}
        emptyText="مفيش مشتريات خامات كافيه في الفترة دي."
      />

      <ReportTable
        title="رصيد مخزن الكافيه حاليًا"
        columns={[
          { header: 'الخامة' }, { header: 'الفئة' }, { header: 'الرصيد', align: 'end' as const },
          { header: 'قيمة الرصيد', align: 'end' as const },
        ]}
        rows={stockRows.map((r) => [
          r.name, r.category,
          <span key="q" className={`font-bold tabular-nums ${r.low ? 'text-red-600' : ''}`}>{fmt(r.qty)} {r.unit}{r.low ? ' ⚠️' : ''}</span>,
          money(r.value),
        ])}
        footer={['الإجمالي', '', '', money(stockValue)]}
        emptyText="مفيش خامات كافيه."
      />
    </ReportShell>
  )
}
