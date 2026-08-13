import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Gauge, AlertTriangle, Factory, TrendingDown, Scale, CheckCircle2 } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, hasSectionAccess } from '@/lib/permissions'
import { PeriodSelector } from '@/components/period-selector'
import { GroupBarChart } from '@/components/group-charts'
import { ExportButtons } from '@/components/export-buttons'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 1 })
const fmt2 = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

function buildPeriod(sp: { days?: string; from?: string; to?: string }) {
  if (sp.from && sp.to) {
    const from = new Date(sp.from); from.setHours(0, 0, 0, 0)
    const to = new Date(sp.to); to.setHours(23, 59, 59, 999)
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
    return { from, to, days }
  }
  const days = Math.min(90, Math.max(1, Number(sp.days) || 7))
  const from = new Date(); from.setDate(from.getDate() - (days - 1)); from.setHours(0, 0, 0, 0)
  const to = new Date(); to.setHours(23, 59, 59, 999)
  return { from, to, days }
}

// تقرير مراقبة الجودة (KPIs): كل التشغيلات بنسب هدرها الفعلية مقارنة بالمتوسطات التقديرية المدخلة
// (المتوقع من الوصفة، والحد المسموح من إعدادات العملية) — بالتشغيلة واليوم والخط
export default async function QualityReportPage({ searchParams: raw }: { searchParams: Promise<{ days?: string; from?: string; to?: string; op?: string }> }) {
  const sp = await raw
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!hasSectionAccess(perms, 'factory')) redirect('/dashboard')

  const { from, to, days } = buildPeriod(sp)
  const opFilter = sp.op || ''

  const productions = await prisma.production.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: from, lte: to } },
    include: {
      operation: { select: { name: true, maxWastePercent: true } },
      recipe: { select: { name: true, expectedWaste: true } },
      items: { include: { product: { select: { name: true, gramsPerPiece: true, packaging: { select: { tareWeight: true } } } } } },
    },
    orderBy: { completedAt: 'desc' },
  })

  // حقل stage بيتخزن فيه وصف تفصيلي ("تحميص فاتح — اندونيسي") — بنطبّعه لـ 3 خطوط رئيسية
  const lineOf = (stage: string) =>
    stage.startsWith('تحميص') ? 'تحميص'
    : stage.startsWith('تعبئة') ? 'تعبئة'
    : stage.startsWith('طحن') || stage.includes('توليف') ? 'طحن وتوليف'
    : stage

  // ─── تجهيز صفوف التشغيلات: فعلي vs تقديري ───
  const allRows = productions.map((p) => {
    const isPack = p.stage.startsWith('تعبئة')
    const inputKg = Number(p.inputWeight)
    const wasteKg = Number(p.wasteWeight)
    const actualPct = Number(p.wastePercent)
    // المرجع التقديري: المتوقع من الوصفة لو موجود، وإلا الحد المسموح للعملية
    const recipeExpected = Number(p.recipe?.expectedWaste || 0)
    const opMax = Number(p.operation?.maxWastePercent || 0)
    const expectedPct = recipeExpected > 0 ? recipeExpected : opMax
    const expectedSource = recipeExpected > 0 ? 'وصفة' : opMax > 0 ? 'حد العملية' : null
    const deviation = expectedPct > 0 ? actualPct - expectedPct : null
    const finProduct = p.items[0]?.product
    const gramsPerPiece = Number(finProduct?.gramsPerPiece || 0)
    const bags = isPack ? Number(p.outputWeight) : null
    const outputKg = isPack ? (bags! * gramsPerPiece) / 1000 : Number(p.outputWeight)
    const estTare = Number(finProduct?.packaging?.tareWeight || 0)
    const actTare = p.actualTareWeight != null ? Number(p.actualTareWeight) : null
    return {
      id: p.id,
      batchNo: p.batchNo || p.orderNo,
      date: p.completedAt || p.createdAt,
      line: lineOf(p.stage),
      stage: p.stage,
      productName: finProduct?.name || '—',
      inputKg, outputKg, bags, wasteKg, actualPct,
      expectedPct, expectedSource, deviation,
      estTare, actTare,
      exceeded: p.wasteExceeded,
    }
  })

  const lines = Array.from(new Set(allRows.map((r) => r.line)))
  const rows = opFilter ? allRows.filter((r) => r.line === opFilter) : allRows

  // ─── KPIs إجمالية ───
  const totalInput = rows.reduce((s, r) => s + r.inputKg, 0)
  const totalWaste = rows.reduce((s, r) => s + r.wasteKg, 0)
  const avgActualPct = totalInput > 0 ? (totalWaste / totalInput) * 100 : 0
  const benchmarked = rows.filter((r) => r.expectedPct > 0)
  const avgExpectedPct = benchmarked.length
    ? benchmarked.reduce((s, r) => s + r.expectedPct * r.inputKg, 0) / Math.max(1, benchmarked.reduce((s, r) => s + r.inputKg, 0))
    : 0
  const exceededCount = rows.filter((r) => r.exceeded).length

  // ─── ملخص حسب الخط (العملية) ───
  const byLine = new Map<string, { runs: number; input: number; waste: number; expWeighted: number; expInput: number; exceeded: number }>()
  for (const r of rows) {
    const l = byLine.get(r.line) || { runs: 0, input: 0, waste: 0, expWeighted: 0, expInput: 0, exceeded: 0 }
    l.runs++; l.input += r.inputKg; l.waste += r.wasteKg
    if (r.expectedPct > 0) { l.expWeighted += r.expectedPct * r.inputKg; l.expInput += r.inputKg }
    if (r.exceeded) l.exceeded++
    byLine.set(r.line, l)
  }
  const lineSummary = Array.from(byLine.entries()).map(([line, l]) => ({
    line, runs: l.runs, input: l.input, waste: l.waste,
    actualPct: l.input > 0 ? (l.waste / l.input) * 100 : 0,
    expectedPct: l.expInput > 0 ? l.expWeighted / l.expInput : 0,
    exceeded: l.exceeded,
  })).sort((a, b) => b.actualPct - a.actualPct)

  // ─── الهدر٪ اليومي ───
  const byDay = new Map<string, { input: number; waste: number }>()
  const cursor = new Date(from)
  const dayKey = (d: Date) => d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
  for (let i = 0; i < days; i++) { byDay.set(dayKey(cursor), { input: 0, waste: 0 }); cursor.setDate(cursor.getDate() + 1) }
  for (const r of rows) {
    const k = dayKey(new Date(r.date))
    const d = byDay.get(k)
    if (d) { d.input += r.inputKg; d.waste += r.wasteKg }
  }
  const dailyWastePct = Array.from(byDay.entries())
    .filter(([, v]) => v.input > 0)
    .map(([label, v]) => ({ label, value: +(((v.waste / v.input) * 100)).toFixed(2) }))

  const d = (dt: Date) => new Date(dt).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const exportRows = rows.map((r) => [
    r.batchNo, d(r.date), r.line, r.productName,
    fmt2(r.inputKg), r.bags != null ? `${r.bags} كيس (${fmt2(r.outputKg)} كجم)` : fmt2(r.outputKg),
    fmt2(r.wasteKg), `${fmt2(r.actualPct)}%`,
    r.expectedPct > 0 ? `${fmt2(r.expectedPct)}% (${r.expectedSource})` : '—',
    r.deviation != null ? `${r.deviation > 0 ? '+' : ''}${fmt2(r.deviation)}%` : '—',
    r.actTare != null ? `${fmt2(r.actTare)} جم (فعلي)` : r.estTare > 0 ? `${fmt2(r.estTare)} جم (تقديري)` : '—',
    r.exceeded ? 'تجاوز الحد' : 'داخل الحد',
  ])

  const kpis = [
    { label: 'عدد التشغيلات', value: rows.length.toLocaleString('ar-EG'), Icon: Factory, cls: 'text-[#0f3460]', bg: 'bg-blue-50' },
    { label: 'إجمالي الداخل (كجم)', value: fmt(totalInput), Icon: Scale, cls: 'text-gray-700', bg: 'bg-gray-100' },
    { label: 'إجمالي الهدر (كجم)', value: fmt(totalWaste), Icon: TrendingDown, cls: 'text-red-600', bg: 'bg-red-50' },
    { label: 'متوسط الهدر الفعلي', value: `${fmt2(avgActualPct)}%`, Icon: Gauge, cls: avgExpectedPct > 0 && avgActualPct > avgExpectedPct ? 'text-red-600' : 'text-green-700', bg: 'bg-amber-50' },
    { label: 'متوسط التقديري المُدخل', value: avgExpectedPct > 0 ? `${fmt2(avgExpectedPct)}%` : '—', Icon: Gauge, cls: 'text-gray-600', bg: 'bg-gray-100' },
    { label: 'تشغيلات تجاوزت الحد', value: exceededCount.toLocaleString('ar-EG'), Icon: AlertTriangle, cls: exceededCount > 0 ? 'text-red-600' : 'text-green-700', bg: exceededCount > 0 ? 'bg-red-50' : 'bg-green-50' },
  ]

  const opLink = (opId: string) => {
    const q = new URLSearchParams()
    if (sp.days) q.set('days', sp.days)
    if (sp.from) q.set('from', sp.from)
    if (sp.to) q.set('to', sp.to)
    if (opId) q.set('op', opId)
    return `/factory/quality${q.toString() ? `?${q.toString()}` : ''}`
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2"><Gauge className="w-7 h-7 text-[#e94560]" /> مراقبة الجودة — KPIs التصنيع</h1>
          <p className="text-sm text-gray-500 mt-0.5">نسب الهدر الفعلية لكل تشغيلة/يوم/خط مقارنة بالمتوسطات التقديرية المُدخلة</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportButtons
            fileName="مراقبة-الجودة"
            headers={['التشغيلة', 'التاريخ', 'الخط', 'المنتج', 'الداخل كجم', 'الناتج', 'الهدر كجم', 'الهدر الفعلي', 'التقديري', 'الانحراف', 'وزن الفارغ', 'الحالة']}
            rows={exportRows}
          />
          <PeriodSelector current={sp.from && sp.to ? 0 : days} basePath="/factory/quality" theme="light" />
        </div>
      </div>

      {/* فلتر الخط/العملية */}
      <div className="bg-white rounded-xl shadow-sm p-4 no-print">
        <div className="flex flex-wrap gap-1.5">
          <Link href={opLink('') as any} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${!opFilter ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>كل الخطوط</Link>
          {lines.map((l) => (
            <Link key={l} href={opLink(l) as any} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${opFilter === l ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}><k.Icon className={`w-5 h-5 ${k.cls}`} /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500">{k.label}</p>
              <p className={`text-base font-bold tabular-nums ${k.cls}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ملخص حسب الخط */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <h3 className="text-sm font-bold text-[#1a1a2e] p-5 pb-3">ملخص حسب الخط</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50 text-xs">
                <th className="p-3 font-medium">الخط</th>
                <th className="p-3 font-medium">تشغيلات</th>
                <th className="p-3 font-medium">الداخل (كجم)</th>
                <th className="p-3 font-medium">الهدر (كجم)</th>
                <th className="p-3 font-medium">الهدر الفعلي</th>
                <th className="p-3 font-medium">التقديري</th>
                <th className="p-3 font-medium">تجاوزت الحد</th>
              </tr>
            </thead>
            <tbody>
              {lineSummary.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-sm">مفيش تشغيلات مقفولة في الفترة دي.</td></tr>}
              {lineSummary.map((l) => (
                <tr key={l.line} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold text-[#1a1a2e]">{l.line}</td>
                  <td className="p-3 tabular-nums">{l.runs.toLocaleString('ar-EG')}</td>
                  <td className="p-3 tabular-nums">{fmt(l.input)}</td>
                  <td className="p-3 tabular-nums text-red-600 font-semibold">{fmt(l.waste)}</td>
                  <td className="p-3 tabular-nums font-bold">
                    <span className={l.expectedPct > 0 && l.actualPct > l.expectedPct ? 'text-red-600' : 'text-green-700'}>{fmt2(l.actualPct)}%</span>
                  </td>
                  <td className="p-3 tabular-nums text-gray-500">{l.expectedPct > 0 ? `${fmt2(l.expectedPct)}%` : '—'}</td>
                  <td className="p-3 tabular-nums">{l.exceeded > 0 ? <span className="text-red-600 font-bold">{l.exceeded.toLocaleString('ar-EG')}</span> : <span className="text-green-700">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <GroupBarChart title="نسبة الهدر اليومية %" subtitle="إجمالي الهدر ÷ إجمالي الداخل لكل يوم فيه تشغيل" items={dailyWastePct} color="#ef4444" money={false} emptyText="مفيش تشغيلات في الفترة" />

      {/* جدول التشغيلات التفصيلي */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <h3 className="text-sm font-bold text-[#1a1a2e] p-5 pb-3">التشغيلات — فعلي مقابل تقديري</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50 text-xs">
                <th className="p-3 font-medium">التشغيلة</th>
                <th className="p-3 font-medium">التاريخ</th>
                <th className="p-3 font-medium">الخط</th>
                <th className="p-3 font-medium">المنتج</th>
                <th className="p-3 font-medium">الداخل</th>
                <th className="p-3 font-medium">الناتج</th>
                <th className="p-3 font-medium">الهدر الفعلي</th>
                <th className="p-3 font-medium">التقديري</th>
                <th className="p-3 font-medium">الانحراف</th>
                <th className="p-3 font-medium">وزن الفارغ</th>
                <th className="p-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-gray-400 text-sm">مفيش تشغيلات مقفولة في الفترة دي.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 ${r.exceeded ? 'bg-red-50/40' : ''}`}>
                  <td className="p-3 font-semibold tabular-nums text-xs">{r.batchNo}</td>
                  <td className="p-3 text-xs text-gray-500 tabular-nums whitespace-nowrap">{d(r.date)}</td>
                  <td className="p-3 text-xs">
                    {r.line}
                    {r.stage !== r.line && <span className="block text-[10px] text-gray-400">{r.stage}</span>}
                  </td>
                  <td className="p-3 text-xs">{r.productName}</td>
                  <td className="p-3 tabular-nums text-xs">{fmt2(r.inputKg)} كجم</td>
                  <td className="p-3 tabular-nums text-xs">{r.bags != null ? `${r.bags.toLocaleString('ar-EG')} كيس (${fmt2(r.outputKg)} كجم)` : `${fmt2(r.outputKg)} كجم`}</td>
                  <td className="p-3 tabular-nums font-bold">
                    <span className={r.expectedPct > 0 && r.actualPct > r.expectedPct ? 'text-red-600' : 'text-green-700'}>{fmt2(r.actualPct)}%</span>
                    <span className="block text-[10px] text-gray-400 font-normal">{fmt2(r.wasteKg)} كجم</span>
                  </td>
                  <td className="p-3 tabular-nums text-xs text-gray-500">
                    {r.expectedPct > 0 ? <>{fmt2(r.expectedPct)}%<span className="block text-[10px] text-gray-400">({r.expectedSource})</span></> : '—'}
                  </td>
                  <td className="p-3 tabular-nums text-xs font-bold">
                    {r.deviation != null
                      ? <span className={r.deviation > 0 ? 'text-red-600' : 'text-green-700'}>{r.deviation > 0 ? '+' : ''}{fmt2(r.deviation)}%</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="p-3 tabular-nums text-xs">
                    {r.actTare != null
                      ? <span className="text-green-700 font-semibold" title={`التقديري: ${fmt2(r.estTare)} جم`}>{fmt2(r.actTare)} جم <span className="text-[10px]">(فعلي)</span></span>
                      : r.estTare > 0 ? <span className="text-gray-500">{fmt2(r.estTare)} جم <span className="text-[10px]">(تقديري)</span></span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="p-3">
                    {r.exceeded
                      ? <span className="flex items-center gap-1 text-[11px] font-bold text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> تجاوز الحد</span>
                      : <span className="flex items-center gap-1 text-[11px] font-bold text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> داخل الحد</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
