import { prisma } from '@/lib/prisma'
import { ReportShell } from '@/components/report-shell'
import { ReportTable } from '@/components/report-table'
import { fmt, money, parsePeriod, dateTime } from '@/lib/report-utils'

export const dynamic = 'force-dynamic'

export default async function StockMovementReport({ searchParams }: { searchParams: { from?: string; to?: string; productId?: string } }) {
  const { fromStr, toStr, period } = parsePeriod(searchParams)
  const productId = searchParams.productId || ''

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, unit: true, quantity: true },
    orderBy: { name: 'asc' },
  })

  type Movement = { date: Date; type: string; qty: number; warehouse: string; reference: string; user: string }
  const movements: Movement[] = []

  if (productId) {
    const [ins, outs, transfers, invoiceItems, prodInputs, prodItems] = await Promise.all([
      prisma.warehouseIn.findMany({
        where: { productId, createdAt: period },
        include: { warehouse: { select: { name: true } }, creator: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.warehouseOut.findMany({
        where: { productId, createdAt: period },
        include: { warehouse: { select: { name: true } }, creator: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockTransfer.findMany({
        where: { productId, createdAt: period, status: 'EXECUTED' },
        include: {
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          creator: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoiceItem.findMany({
        where: { productId, invoice: { createdAt: period, status: 'COMPLETED' } },
        include: { invoice: { select: { invoiceNo: true, createdAt: true, creator: { select: { name: true } } } } },
        orderBy: { invoice: { createdAt: 'desc' } },
      }),
      prisma.productionInput.findMany({
        where: { productId, production: { createdAt: period } },
        include: { production: { select: { batchNo: true, createdAt: true, creator: { select: { name: true } } } } },
        orderBy: { production: { createdAt: 'desc' } },
      }),
      prisma.productionItem.findMany({
        where: { productId, production: { createdAt: period } },
        include: { production: { select: { batchNo: true, createdAt: true, creator: { select: { name: true } } } } },
        orderBy: { production: { createdAt: 'desc' } },
      }),
    ])

    ins.forEach(r => movements.push({
      date: r.createdAt, type: 'وارد', qty: r.quantity,
      warehouse: r.warehouse?.name || '—', reference: r.source, user: r.creator.name,
    }))
    outs.forEach(r => movements.push({
      date: r.createdAt, type: 'صادر', qty: -r.quantity,
      warehouse: r.warehouse?.name || '—', reference: r.reason + (r.target ? ` — ${r.target}` : ''), user: r.creator.name,
    }))
    transfers.forEach(r => {
      movements.push({
        date: r.createdAt, type: 'تحويل صادر', qty: -r.quantity,
        warehouse: r.fromWarehouse.name, reference: `تحويل #${r.transferNo} → ${r.toWarehouse.name}`, user: r.creator.name,
      })
      movements.push({
        date: r.createdAt, type: 'تحويل وارد', qty: r.quantity,
        warehouse: r.toWarehouse.name, reference: `تحويل #${r.transferNo} ← ${r.fromWarehouse.name}`, user: r.creator.name,
      })
    })
    invoiceItems.forEach(r => movements.push({
      date: r.invoice.createdAt, type: 'بيع', qty: -r.quantity,
      warehouse: '—', reference: `فاتورة #${r.invoice.invoiceNo}`, user: r.invoice.creator.name,
    }))
    prodInputs.forEach(r => movements.push({
      date: r.production.createdAt, type: 'خامات إنتاج', qty: -r.quantity,
      warehouse: '—', reference: `تصنيع #${r.production.batchNo || ''}`, user: r.production.creator.name,
    }))
    prodItems.forEach(r => movements.push({
      date: r.production.createdAt, type: 'ناتج إنتاج', qty: r.quantity,
      warehouse: '—', reference: `تصنيع #${r.production.batchNo || ''}`, user: r.production.creator.name,
    }))

    movements.sort((a, b) => b.date.getTime() - a.date.getTime())
  }

  const selectedProduct = products.find(p => p.id === productId)
  const totalIn = movements.filter(m => m.qty > 0).reduce((s, m) => s + m.qty, 0)
  const totalOut = movements.filter(m => m.qty < 0).reduce((s, m) => s + Math.abs(m.qty), 0)

  const TYPE_CLS: Record<string, string> = {
    'وارد': 'bg-green-50 text-green-700',
    'صادر': 'bg-red-50 text-red-700',
    'تحويل صادر': 'bg-orange-50 text-orange-700',
    'تحويل وارد': 'bg-blue-50 text-blue-700',
    'بيع': 'bg-purple-50 text-purple-700',
    'خامات إنتاج': 'bg-amber-50 text-amber-700',
    'ناتج إنتاج': 'bg-emerald-50 text-emerald-700',
  }

  const columns = [
    { header: 'التاريخ' }, { header: 'النوع', align: 'center' as const },
    { header: 'الكمية', align: 'end' as const }, { header: 'المخزن' },
    { header: 'المرجع' }, { header: 'بواسطة' },
  ]
  const rows = movements.map(m => [
    <span key="d" className="text-xs tabular-nums whitespace-nowrap">{dateTime(m.date)}</span>,
    <span key="t" className={`px-2 py-0.5 rounded text-[10px] font-semibold ${TYPE_CLS[m.type] || 'bg-gray-100 text-gray-600'}`}>{m.type}</span>,
    <span key="q" className={`font-bold tabular-nums ${m.qty > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</span>,
    <span key="w" className="text-xs text-gray-500">{m.warehouse}</span>,
    <span key="r" className="text-xs text-gray-600 max-w-[200px] truncate block">{m.reference}</span>,
    <span key="u" className="text-xs text-gray-500">{m.user}</span>,
  ])
  const exportRows = movements.map(m => [
    dateTime(m.date), m.type, m.qty, m.warehouse, m.reference, m.user,
  ])

  return (
    <ReportShell
      title="حركة صنف" subtitle={selectedProduct ? `${selectedProduct.name} — الرصيد الحالي: ${selectedProduct.quantity} ${selectedProduct.unit}` : 'اختر صنفًا لعرض حركاته'}
      basePath="/finance/stock-movement" from={fromStr} to={toStr}
      exportName={`حركة-${selectedProduct?.name || 'صنف'}-${fromStr}_${toStr}`}
      exportHeaders={columns.map(c => c.header)} exportRows={exportRows}
      kpis={productId ? [
        { label: 'إجمالي الوارد', value: fmt(totalIn), color: 'text-green-600' },
        { label: 'إجمالي الصادر', value: fmt(totalOut), color: 'text-red-600' },
        { label: 'صافي الحركة', value: fmt(totalIn - totalOut), color: totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600' },
        { label: 'عدد الحركات', value: fmt(movements.length), color: 'text-[#0f3460]' },
      ] : undefined}
    >
      {/* Product Selector */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <form method="GET" className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">اختر الصنف</label>
            <select name="productId" defaultValue={productId}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0f3460] outline-none">
              <option value="">— اختر صنف —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</option>)}
            </select>
          </div>
          <input type="hidden" name="from" value={fromStr} />
          <input type="hidden" name="to" value={toStr} />
          <button type="submit" className="px-5 py-2 bg-[#0f3460] text-white rounded-xl text-sm font-semibold hover:bg-[#0a2540] transition-colors">
            عرض الحركات
          </button>
        </form>
      </div>

      {productId && (
        <ReportTable title={`حركات ${selectedProduct?.name || ''}`} columns={columns} rows={rows}
          emptyText="لا توجد حركات في الفترة المحددة"
          footer={['', '', `وارد: ${totalIn} | صادر: ${totalOut}`, '', '', '']}
        />
      )}
    </ReportShell>
  )
}
