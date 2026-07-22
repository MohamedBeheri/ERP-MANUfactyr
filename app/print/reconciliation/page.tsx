import { computeReconciliation } from '@/lib/reconciliation'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export const dynamic = 'force-dynamic'

export default async function ReconciliationPrintPage({ searchParams }: { searchParams: { from?: string; to?: string; channel?: string } }) {
  const now = new Date()
  const from = searchParams.from ? new Date(searchParams.from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const to = searchParams.to ? new Date(searchParams.to + 'T23:59:59') : now
  const channel = searchParams.channel || undefined
  const d = await computeReconciliation(from, to, channel)

  const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
  const dd = (x: Date) => new Date(x).toLocaleDateString('ar-EG')

  return (
    <PrintDoc
      title="محضر التشغيل"
      docNo={channel || 'كل القنوات'}
      date={now}
      meta={[
        { label: 'الفترة', value: `${dd(from)} — ${dd(to)}` },
        { label: 'القناة', value: channel || 'كل القنوات' },
        { label: 'عدد أوامر التصنيع', value: String(d.ordersCount) },
      ]}
      signatures={['مدير المصنع', 'المراجعة']}
    >
      {d.greens.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '4px 0 8px' }}>البن الأخضر المستهلك</h3>
          <PrintTable
            headers={['#', 'الصنف', 'المطلوب (كجم)', 'نسبة الخسران', 'الفعلي', 'العجز/الزيادة']}
            rows={d.greens.map((g, i) => [i + 1, g.name, fmt(g.kg), `${fmt(g.roastLoss)}%`, '............', '............'])}
          />
        </>
      )}

      {d.spices.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>العطارة المستهلكة</h3>
          <PrintTable
            headers={['#', 'الصنف', 'المطلوب (كجم)', 'الفعلي', 'العجز/الزيادة']}
            rows={d.spices.map((s, i) => [i + 1, s.name, fmt(s.kg), '............', '............'])}
          />
        </>
      )}

      {d.blends.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>التوليفات المنتجة</h3>
          <PrintTable
            headers={['#', 'التوليفة', 'المدخل', 'الناتج', 'الهدر', 'نسبة الهدر']}
            rows={d.blends.map((b, i) => [i + 1, b.name, fmt(b.input), fmt(b.output), fmt(b.waste), `${fmt(b.lossPercent)}%`])}
          />
        </>
      )}

      {d.finished.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>المنتجات المعبّأة</h3>
          <PrintTable
            headers={['#', 'المنتج', 'العلب', 'البن المستهلك (كجم)']}
            rows={d.finished.map((f, i) => [i + 1, f.name, f.boxes, fmt(f.coffeeKg)])}
          />
        </>
      )}

      {d.packaging.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: '16px 0 8px' }}>مواد التغليف المستهلكة</h3>
          <PrintTable headers={['#', 'المادة', 'القطع']} rows={d.packaging.map((p, i) => [i + 1, p.name, p.pieces])} />
        </>
      )}
    </PrintDoc>
  )
}
