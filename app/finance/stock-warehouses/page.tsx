import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function StockWarehousesReport({ searchParams: rawSearchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await rawSearchParams;
  const { fromStr, toStr } = parsePeriod(searchParams)

  const [warehouses, products, allStocks, transfers] = await Promise.all([
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true, costPrice: true, quantity: true, minStock: true, type: true }, orderBy: { name: 'asc' } }),
    prisma.productStock.findMany({ include: { warehouse: { select: { name: true } }, product: { select: { name: true, unit: true, costPrice: true } } } }),
    prisma.stockTransfer.count({ where: { status: 'EXECUTED' } }),
  ])

  const stockMap = new Map<string, Map<string, number>>()
  allStocks.forEach(s => {
    if (!stockMap.has(s.warehouseId)) stockMap.set(s.warehouseId, new Map())
    stockMap.get(s.warehouseId)!.set(s.productId, Number(s.quantity))
  })

  const warehouseStats = warehouses.map(w => {
    const stocks = stockMap.get(w.id) || new Map<string, number>()
    let totalItems = 0
    let totalValue = 0
    let lowStockCount = 0
    const productRows: { name: string; unit: string; qty: number; value: number; isLow: boolean }[] = []

    products.forEach(p => {
      const qty = stocks.get(p.id) || 0
      if (qty > 0) {
        const val = qty * Number(p.costPrice)
        totalItems += qty
        totalValue += val
        const isLow = qty <= Number(p.minStock) && Number(p.minStock) > 0
        if (isLow) lowStockCount++
        productRows.push({ name: p.name, unit: p.unit, qty, value: val, isLow })
      }
    })

    return { ...w, totalItems, totalValue, lowStockCount, productRows, productCount: productRows.length }
  })

  const grandTotalValue = warehouseStats.reduce((s, w) => s + w.totalValue, 0)
  const grandTotalItems = warehouseStats.reduce((s, w) => s + w.totalItems, 0)
  const totalLow = warehouseStats.reduce((s, w) => s + w.lowStockCount, 0)

  const columns = [
    { header: 'الصنف' }, { header: 'الكمية', align: 'end' as const },
    { header: 'الوحدة' }, { header: 'القيمة', align: 'end' as const },
    { header: 'الحالة', align: 'center' as const },
  ]
  const allExportRows: (string | number)[][] = []
  warehouseStats.forEach(w => {
    allExportRows.push([`=== ${w.name} ===`, '', '', '', ''])
    w.productRows.forEach(p => {
      allExportRows.push([p.name, p.qty, p.unit, p.value.toFixed(2), p.isLow ? 'تحت الحد' : 'طبيعي'])
    })
    allExportRows.push(['المجموع', w.totalItems, '', w.totalValue.toFixed(2), ''])
    allExportRows.push(['', '', '', '', ''])
  })

  return (
    <ReportShell
      title="الأصناف حسب المخزن" subtitle="أرصدة وقيم كل صنف في كل مخزن" basePath="/finance/stock-warehouses"
      from={fromStr} to={toStr} exportName={`أرصدة-المخازن`}
      exportHeaders={columns.map(c => c.header)} exportRows={allExportRows}
      kpis={[
        { label: 'عدد المخازن', value: fmt(warehouses.length), color: 'text-[#0f3460]' },
        { label: 'إجمالي الأصناف', value: fmt(grandTotalItems), color: 'text-[#0f3460]' },
        { label: 'إجمالي القيمة', value: money(grandTotalValue), color: 'text-green-600' },
        { label: 'تحت الحد الأدنى', value: fmt(totalLow), color: totalLow > 0 ? 'text-red-600' : 'text-green-600' },
      ]}
    >
      {/* Distribution Chart */}
      {warehouseStats.length > 1 && grandTotalValue > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-[#1a1a2e]">توزيع القيمة بين المخازن</p>
          <div className="space-y-2">
            {warehouseStats.filter(w => w.totalValue > 0).map(w => (
              <div key={w.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-[#1a1a2e]">{w.name}</span>
                  <span className="tabular-nums text-gray-500">{money(w.totalValue)} ({pct(w.totalValue, grandTotalValue)}%)</span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-[#0f3460] rounded-full transition-all" style={{ width: `${pct(w.totalValue, grandTotalValue)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-warehouse tables */}
      {warehouseStats.map(w => (
        <div key={w.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <h3 className="text-base font-bold text-[#1a1a2e]">{w.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{w.productCount} صنف · {fmt(w.totalItems)} وحدة · {money(w.totalValue)}</p>
            </div>
            {w.lowStockCount > 0 && (
              <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs font-semibold">{w.lowStockCount} تحت الحد</span>
            )}
          </div>
          {w.productRows.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-400">لا توجد أرصدة في هذا المخزن</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                    <th className="p-3 font-medium">الصنف</th>
                    <th className="p-3 font-medium text-left">الكمية</th>
                    <th className="p-3 font-medium">الوحدة</th>
                    <th className="p-3 font-medium text-left">القيمة</th>
                    <th className="p-3 font-medium text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {w.productRows.map((p, i) => (
                    <tr key={i} className={`border-b border-gray-50 last:border-0 ${p.isLow ? 'bg-red-50/30' : 'hover:bg-gray-50/50'}`}>
                      <td className="p-3 font-semibold">{p.name}</td>
                      <td className="p-3 text-left tabular-nums font-bold">{p.qty}</td>
                      <td className="p-3 text-gray-500 text-xs">{p.unit}</td>
                      <td className="p-3 text-left tabular-nums">{money(p.value)}</td>
                      <td className="p-3 text-center">
                        {p.isLow ? (
                          <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-semibold">تحت الحد</span>
                        ) : (
                          <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded text-[10px] font-semibold">طبيعي</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold text-sm border-t border-gray-200">
                    <td className="p-3">المجموع</td>
                    <td className="p-3 text-left tabular-nums">{fmt(w.totalItems)}</td>
                    <td className="p-3"></td>
                    <td className="p-3 text-left tabular-nums">{money(w.totalValue)}</td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Transfer stats */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <p className="text-sm font-bold text-[#1a1a2e] mb-1">ملخص التحويلات بين المخازن</p>
        <p className="text-xs text-gray-500">إجمالي التحويلات المنفّذة: <span className="font-bold text-[#0f3460]">{transfers}</span> عملية</p>
      </div>
    </ReportShell>
  )
}
