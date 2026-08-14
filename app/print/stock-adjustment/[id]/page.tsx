import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'مسودة', IN_PROGRESS: 'جاري العد', REVIEWING: 'مراجعة الفروق',
  POSTED: 'معتمد ومرحّل', CLOSED: 'مغلق', REVERSED: 'اتلغى اعتماده',
}
const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const qty = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 3 })

export default async function StockAdjustmentPrint({ params: rawParams, searchParams: rawSp }: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const params = await rawParams
  const sp = await rawSp
  const sheet = sp?.sheet === '1' // كشف عدّ للتوقيع (بدون أرقام النظام والفروق والتكلفة)
  const adj = await prisma.stockAdjustment.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      journalEntry: { include: { lines: { include: { account: true } } } },
      items: { include: { product: { select: { name: true, unit: true, lotTracked: true } } }, orderBy: { product: { name: 'asc' } } },
    },
  })
  if (!adj) notFound()

  const typeLabel = adj.adjustmentType === 'SHORTAGE_ONLY' ? 'عجز فقط' : adj.adjustmentType === 'SURPLUS_ONLY' ? 'زيادة فقط' : 'شاملة'
  // بنعرض الأصناف اللي اتعدّت وليها فرق أو الكل لو معتمد
  const rows = adj.items.filter((it) => it.countedQty != null)
  const lotRows = rows.filter((it) => it.product.lotTracked && (it.batchNo || it.expiryDate || it.binLocation))

  // في كشف العدّ للتوقيع بنعرض كل الأصناف (حتى اللي ما اتعدّتش) عشان أمين المخزن يوقّع
  const sheetRows = sheet ? adj.items : rows

  return (
    <PrintDoc
      title={sheet ? 'كشف عدّ الجرد — للتوقيع' : 'مستند تسوية الجرد'}
      docNo={adj.docNo}
      date={adj.createdAt}
      meta={[
        { label: 'المخزن', value: adj.warehouse.name },
        { label: 'الحالة', value: STATUS_LABEL[adj.status] || adj.status },
        { label: 'نوع التسوية', value: typeLabel },
        { label: 'سبب التسوية', value: adj.reasonCode || '—' },
        { label: 'إذن الجرد المرجعي', value: adj.stocktakeRef || '—' },
        { label: 'القائم بالعدّ', value: adj.createdBy.name },
        ...(sheet ? [] : [
          { label: 'اعتمدها', value: adj.approvedBy?.name || '—' },
          { label: 'تاريخ الترحيل', value: adj.postingDate ? new Date(adj.postingDate).toLocaleString('ar-EG') : '—' },
        ]),
      ]}
      footerNote={adj.notes ? `ملاحظات: ${adj.notes}` : undefined}
      signatures={['القائم بالعدّ', 'أمين المخزن', sheet ? 'المراجع' : 'المدير المالي']}
    >
      {sheet ? (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">كشف العدّ الفعلي</h4>
          <PrintTable
            headers={['#', 'الصنف', 'الوحدة', 'الكمية المعدودة']}
            rows={sheetRows.map((it, i) => [
              i + 1,
              it.product.name,
              it.product.unit,
              it.countedQty != null ? qty(Number(it.countedQty)) : '—',
            ])}
          />
        </div>
      ) : (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">تفصيل فروق الجرد</h4>
          <PrintTable
            headers={['الصنف', 'الرصيد الدفتري', 'المعدود', 'الفرق', 'تكلفة الوحدة', 'قيمة الفرق', 'الحالة']}
            rows={rows.map((it) => {
              const v = Number(it.varianceQty)
              return [
                `${it.product.name} (${it.product.unit})`,
                qty(Number(it.snapshotQty)),
                qty(Number(it.countedQty)),
                (v > 0 ? '+' : '') + qty(v),
                money(Number(it.unitCost)),
                v === 0 ? '—' : money(Math.abs(Number(it.varianceCost))),
                v < 0 ? 'عجز' : v > 0 ? 'زيادة' : 'مطابق',
              ]
            })}
          />
        </div>
      )}

      {!sheet && lotRows.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">بيانات اللوت/الصلاحية للأصناف الزائدة</h4>
          <PrintTable
            headers={['الصنف', 'رقم اللوت', 'الصلاحية', 'الموقع/الرف']}
            rows={lotRows.map((it) => [
              it.product.name,
              it.batchNo || '—',
              it.expiryDate ? new Date(it.expiryDate).toLocaleDateString('ar-EG') : '—',
              it.binLocation || '—',
            ])}
          />
        </div>
      )}

      {!sheet && adj.journalEntry && (
        <div className="mb-6">
          <h4 className="font-bold text-sm mb-2">القيد المحاسبي {adj.journalEntry.entryNo}</h4>
          <PrintTable
            headers={['الحساب', 'مدين', 'دائن']}
            rows={adj.journalEntry.lines.map((l) => [
              l.account.name,
              Number(l.debit) > 0 ? money(Number(l.debit)) : '—',
              Number(l.credit) > 0 ? money(Number(l.credit)) : '—',
            ])}
          />
        </div>
      )}

      {!sheet && (
        <PrintTable
          headers={['البيان', 'القيمة']}
          rows={[
            ['إجمالي العجز', `${money(Number(adj.shortageCost))} ج.م`],
            ['إجمالي الزيادة', `${money(Number(adj.surplusCost))} ج.م`],
          ]}
          totals={[{ label: 'صافي الفرق', value: `${money(Number(adj.totalVarianceCost))} ج.م` }]}
        />
      )}
    </PrintDoc>
  )
}
