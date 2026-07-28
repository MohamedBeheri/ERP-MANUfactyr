import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, pct, parsePeriod, dateShort } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function ProductionReport({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)

  const productions = await prisma.production.findMany({
    where: { createdAt: period },
    include: {
      rawProduct: { select: { name: true, unit: true } },
      items: { include: { product: { select: { name: true, unit: true, costPrice: true } } } },
      inputs: { include: { product: { select: { name: true, unit: true, costPrice: true } } } },
      operation: { select: { name: true } },
      creator: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalOrders = productions.length
  const totalRawUsed = productions.reduce((s, p) => s + p.rawUsed, 0)
  const totalProduced = productions.reduce((s, p) => s + p.items.reduce((a, i) => a + i.quantity, 0), 0)
  const inputCost = productions.reduce((s, p) => s + p.inputs.reduce((a, inp) => a + inp.quantity * Number(inp.product.costPrice), 0), 0)
  const outputValue = productions.reduce((s, p) => s + p.items.reduce((a, i) => a + i.quantity * Number(i.product.costPrice), 0), 0)
  const yieldRate = totalRawUsed > 0 ? pct(totalProduced, totalRawUsed) : 0

  // تجميع حسب العملية/المرحلة
  const byOpMap = new Map<string, { count: number; rawUsed: number; produced: number }>()
  productions.forEach(p => {
    const key = p.operation?.name || p.stage || '—'
    const prev = byOpMap.get(key) || { count: 0, rawUsed: 0, produced: 0 }
    prev.count++
    prev.rawUsed += p.rawUsed
    prev.produced += p.items.reduce((a, i) => a + i.quantity, 0)
    byOpMap.set(key, prev)
  })
  const byOp = Array.from(byOpMap.entries())

  // تجميع الخامات المستخدمة
  const rawMap = new Map<string, { qty: number; cost: number; unit: string }>()
  productions.forEach(p => {
    p.inputs.forEach(inp => {
      const key = inp.product.name
      const prev = rawMap.get(key) || { qty: 0, cost: 0, unit: inp.product.unit }
      prev.qty += inp.quantity
      prev.cost += inp.quantity * Number(inp.product.costPrice)
      rawMap.set(key, prev)
    })
  })
  const rawSorted = Array.from(rawMap.entries()).sort((a, b) => b[1].cost - a[1].cost)

  // تجميع الناتج
  const outputMap = new Map<string, { qty: number; value: number; unit: string }>()
  productions.forEach(p => {
    p.items.forEach(i => {
      const key = i.product.name
      const prev = outputMap.get(key) || { qty: 0, value: 0, unit: i.product.unit }
      prev.qty += i.quantity
      prev.value += i.quantity * Number(i.product.costPrice)
      outputMap.set(key, prev)
    })
  })
  const outputSorted = Array.from(outputMap.entries()).sort((a, b) => b[1].value - a[1].value)

  const columns = [
    { header: 'رقم الأمر' }, { header: 'التاريخ' }, { header: 'العملية' },
    { header: 'المدخلات' }, { header: 'الناتج' }, { header: 'المنفذ' },
  ]
  const rows = productions.map(p => [
    <span key="n" className="font-mono text-xs font-semibold">{p.orderNo}</span>,
    dateShort(p.createdAt),
    <span key="o" className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-50 text-orange-600">{p.operation?.name || p.stage}</span>,
    <span key="i" className="text-xs text-gray-600">
      {p.inputs.length > 0
        ? p.inputs.map(inp => `${inp.product.name} ${inp.quantity} ${inp.product.unit}`).join(' + ')
        : p.rawProduct ? `${p.rawProduct.name} ${p.rawUsed} ${p.rawProduct.unit}` : `${p.rawUsed} كجم`
      }
    </span>,
    <span key="out" className="text-xs text-green-700 font-semibold">{p.items.map(i => `${i.product.name} ×${i.quantity}`).join('، ')}</span>,
    <span key="u" className="text-xs text-gray-400">{p.creator?.name || '—'}</span>,
  ])
  const exportRows = productions.map(p => [
    p.orderNo, dateShort(p.createdAt), p.operation?.name || p.stage,
    p.inputs.length > 0 ? p.inputs.map(inp => `${inp.product.name} ${inp.quantity}`).join(' + ') : `${p.rawUsed}`,
    p.items.map(i => `${i.product.name} ×${i.quantity}`).join(', '),
    p.creator?.name || '—',
  ])

  return (
    <ReportShell
      title="تقرير التصنيع" subtitle="أوامر الإنتاج — المدخلات · الناتج · العمليات · التكلفة" basePath="/finance/production"
      from={fromStr} to={toStr} exportName={`التصنيع-${fromStr}_${toStr}`}
      exportHeaders={columns.map(c => c.header)} exportRows={exportRows}
      kpis={[
        { label: 'أوامر التصنيع', value: fmt(totalOrders), color: 'text-orange-600' },
        { label: 'خامات مستخدمة', value: `${fmt(totalRawUsed)} كجم`, color: 'text-amber-600' },
        { label: 'إجمالي الناتج', value: `${fmt(totalProduced)} وحدة`, color: 'text-green-600' },
        { label: 'تكلفة المدخلات', value: money(inputCost), color: 'text-red-600' },
      ]}
    >
      {/* تجميع حسب العملية */}
      {byOp.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {byOp.map(([op, data]) => (
            <div key={op} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">{op}</p>
              <p className="text-lg font-bold tabular-nums text-[#1a1a2e]">{data.count} أمر</p>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
                <span>خام: {fmt(data.rawUsed)}</span>
                <span>ناتج: {fmt(data.produced)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* الخامات المستخدمة */}
      {rawSorted.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <h3 className="text-base font-bold text-[#1a1a2e]">الخامات المستخدمة</h3>
            <span className="mr-auto text-xs text-gray-400">{rawSorted.length} خامة</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">الخامة</th><th className="p-3 font-medium">الكمية</th><th className="p-3 font-medium text-left">التكلفة</th><th className="p-3 font-medium text-left">النسبة</th>
              </tr></thead>
              <tbody>
                {rawSorted.map(([name, data]) => (
                  <tr key={name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-semibold">{name}</td>
                    <td className="p-3 tabular-nums">{fmt(data.qty)} {data.unit}</td>
                    <td className="p-3 tabular-nums font-semibold text-left text-amber-600">{money(data.cost)}</td>
                    <td className="p-3 text-left"><div className="flex items-center gap-2"><span className="tabular-nums text-xs">{pct(data.cost, inputCost)}%</span><div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct(data.cost, inputCost)}%` }} /></div></div></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-gray-200 bg-gray-50 font-bold"><td className="p-3">الإجمالي</td><td className="p-3" /><td className="p-3 tabular-nums text-amber-600 text-left">{money(inputCost)}</td><td className="p-3 text-left">100%</td></tr></tfoot>
            </table>
          </div>
        </section>
      )}

      {/* المنتجات الناتجة */}
      {outputSorted.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <h3 className="text-base font-bold text-[#1a1a2e]">المنتجات الناتجة</h3>
            <span className="mr-auto text-xs text-gray-400">{outputSorted.length} منتج</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">المنتج</th><th className="p-3 font-medium">الكمية</th><th className="p-3 font-medium text-left">القيمة بالتكلفة</th>
              </tr></thead>
              <tbody>
                {outputSorted.map(([name, data]) => (
                  <tr key={name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-semibold">{name}</td>
                    <td className="p-3 tabular-nums">{fmt(data.qty)} {data.unit}</td>
                    <td className="p-3 tabular-nums font-semibold text-left text-green-600">{money(data.value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-gray-200 bg-gray-50 font-bold"><td className="p-3">الإجمالي</td><td className="p-3 tabular-nums">{fmt(totalProduced)}</td><td className="p-3 tabular-nums text-green-600 text-left">{money(outputValue)}</td></tr></tfoot>
            </table>
          </div>
        </section>
      )}

      {/* سجل الأوامر */}
      <ReportTable title="سجل أوامر التصنيع" columns={columns} rows={rows} emptyText="لا توجد أوامر تصنيع في هذه الفترة" />
    </ReportShell>
  )
}
