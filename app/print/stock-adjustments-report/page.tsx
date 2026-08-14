import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const STATUS_LABEL: Record<string, string> = { POSTED: 'معتمد', CLOSED: 'مغلق', REVERSED: 'ملغى' }

// تقرير الجرد بالتاريخ: كل تسويات الجرد المرحّلة في الفترة + إجماليات
export default async function StockAdjustmentsReport({ searchParams: raw }: { searchParams: Promise<{ from?: string; to?: string; warehouseId?: string }> }) {
  const sp = await raw
  const from = sp.from ? new Date(sp.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  from.setHours(0, 0, 0, 0)
  const to = sp.to ? new Date(sp.to) : new Date()
  to.setHours(23, 59, 59, 999)

  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      status: { in: ['POSTED', 'CLOSED', 'REVERSED'] },
      postingDate: { gte: from, lte: to },
      ...(sp.warehouseId ? { warehouseId: sp.warehouseId } : {}),
    },
    include: { warehouse: { select: { name: true } }, approvedBy: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { postingDate: 'asc' },
  })

  const totalShort = adjustments.reduce((s, a) => s + Number(a.shortageCost), 0)
  const totalSurplus = adjustments.reduce((s, a) => s + Number(a.surplusCost), 0)
  const net = totalSurplus - totalShort

  return (
    <PrintDoc
      title="تقرير تسويات الجرد"
      docNo={`RPT-${from.toISOString().slice(0, 10)}`}
      date={new Date()}
      meta={[
        { label: 'من تاريخ', value: from.toLocaleDateString('ar-EG') },
        { label: 'إلى تاريخ', value: to.toLocaleDateString('ar-EG') },
        { label: 'عدد المستندات', value: String(adjustments.length) },
        { label: 'إجمالي العجز', value: `${money(totalShort)} ج.م` },
        { label: 'إجمالي الزيادة', value: `${money(totalSurplus)} ج.م` },
        { label: 'صافي الفرق', value: `${money(net)} ج.م` },
      ]}
      signatures={['أعدّه', 'المدير المالي', 'المدير العام']}
    >
      {adjustments.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>مفيش تسويات جرد مرحّلة في الفترة دي</p>
      ) : (
        <PrintTable
          headers={['#', 'رقم المستند', 'المخزن', 'تاريخ الترحيل', 'أصناف', 'عجز', 'زيادة', 'صافي', 'الحالة', 'اعتمدها']}
          rows={adjustments.map((a, i) => [
            i + 1,
            a.docNo,
            a.warehouse.name,
            a.postingDate ? new Date(a.postingDate).toLocaleDateString('ar-EG') : '—',
            a._count.items,
            `${money(Number(a.shortageCost))}`,
            `${money(Number(a.surplusCost))}`,
            `${money(Number(a.totalVarianceCost))}`,
            STATUS_LABEL[a.status] || a.status,
            a.approvedBy?.name || '—',
          ])}
          totals={[
            { label: 'إجمالي العجز', value: `${money(totalShort)} ج.م` },
            { label: 'إجمالي الزيادة', value: `${money(totalSurplus)} ج.م` },
            { label: 'صافي الفرق', value: `${money(net)} ج.م` },
          ]}
        />
      )}
    </PrintDoc>
  )
}
