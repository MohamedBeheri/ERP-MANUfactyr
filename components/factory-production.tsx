'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Package, TriangleAlert, Wheat, Factory, TrendingDown } from 'lucide-react'

interface GreenT { id: string; name: string; quantity: number; roastLoss: number }
interface BlendComp { name: string; kind: string; percent: number; roastDegree: string | null; perKilo: number; unit: string }
interface BlendT { id: string; name: string; quantity: number; components: BlendComp[] }
interface FinishedT { id: string; name: string; blendName: string | null; hasBlend: boolean; gramsPerPiece: number; piecesPerBox: number; tare: number; packagingName: string | null }
interface ProdT {
  id: string; orderNo: string; batchNo: string | null; stage: string; stageDetail: string
  roastLevel: string | null; grindType: string | null; output: string
  inputWeight: number; outputWeight: number; wasteWeight: number; wastePercent: number; wasteExceeded: boolean; channel: string; createdAt: string
  status: string; outputProductName: string | null
}
interface KpiT {
  greenIn: number; roastedOut: number; roastWaste: number; roastCount: number
  grindIn: number; grindOut: number; grindWaste: number
  packCoffee: number; packUnits: number; packWaste: number
}

const CHANNELS = ['المصنع', 'حلوان (الكافيه)', 'عبدالله (تحميص أجرة)']
const ROAST_DEGREES = ['فاتح', 'وسط', 'غامق', 'غامق جداً']
const GRIND_LEVELS = ['ناعم جداً', 'ناعم', 'متوسط', 'خشن']
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const timeOf = (iso: string) => new Date(iso).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const STAGE_COLORS: Record<string, string> = {
  تحميص: 'bg-orange-50 text-orange-700',
  'طحن وتوليف': 'bg-purple-50 text-purple-700',
  تعبئة: 'bg-blue-50 text-blue-700',
}

export function FactoryProduction({ greens, blends, finished, productions, kpi }: {
  greens: GreenT[]; blends: BlendT[]; finished: FinishedT[]; productions: ProdT[]; kpi: KpiT
}) {
  const router = useRouter()
  const onDone = () => router.refresh()

  // كفاءة الخط الكلية: من الأخضر للمعبأ الصافي
  const packedNet = Math.max(0, kpi.packCoffee - kpi.packWaste)
  const totalWaste = kpi.roastWaste + kpi.grindWaste + kpi.packWaste
  const overallYield = kpi.greenIn > 0 ? (packedNet / kpi.greenIn) * 100 : 0

  return (
    <div className="space-y-6">
      {/* ===== KPI خط التصنيع ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'بن أخضر دخل التحميص', value: `${fmt(kpi.greenIn)} كجم`, sub: `${kpi.roastCount} تشغيلة`, cls: 'text-green-700' },
          { label: 'هدر التحميص', value: `${fmt(kpi.roastWaste)} كجم`, sub: kpi.greenIn ? `${fmt((kpi.roastWaste / kpi.greenIn) * 100)}%` : '—', cls: 'text-orange-600' },
          { label: 'هدر الطحن والتوليف', value: `${fmt(kpi.grindWaste)} كجم`, sub: kpi.grindIn ? `${fmt((kpi.grindWaste / kpi.grindIn) * 100)}%` : '—', cls: 'text-purple-600' },
          { label: 'معبأ صافي', value: `${fmt(packedNet)} كجم`, sub: `${fmt(kpi.packUnits)} عبوة`, cls: 'text-blue-700' },
          { label: 'كفاءة الخط (أخضر ← معبأ)', value: `${fmt(overallYield)}%`, sub: `إجمالي هدر ${fmt(totalWaste)} كجم`, cls: overallYield >= 80 ? 'text-green-700' : 'text-red-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm p-3.5">
            <p className="text-[11px] text-gray-500 truncate">{k.label}</p>
            <p className={`text-base font-bold tabular-nums ${k.cls}`}>{k.value}</p>
            <p className="text-[10px] text-gray-400 tabular-nums">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ===== المراحل الثلاث ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <RoastForm greens={greens} onDone={onDone} />
        <GrindAndBlendForm blends={blends} onDone={onDone} />
        <PackFinished finished={finished} onDone={onDone} />
      </div>

      {/* ===== تشغيلات مفتوحة (بانتظار الإقفال) ===== */}
      <PendingBatches productions={productions} onDone={onDone} />

      {/* ===== سجل التشغيلات ===== */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-5 pb-3">
          <Factory className="w-5 h-5 text-[#0f3460]" />
          <h3 className="text-base font-bold text-[#1a1a2e]">سجل التشغيلات ({productions.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50 text-xs">
                <th className="p-3 font-medium">التشغيلة</th>
                <th className="p-3 font-medium">المرحلة</th>
                <th className="p-3 font-medium">الناتج</th>
                <th className="p-3 font-medium">داخل</th>
                <th className="p-3 font-medium">خارج</th>
                <th className="p-3 font-medium">هدر</th>
                <th className="p-3 font-medium">القناة</th>
                <th className="p-3 font-medium">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {productions.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400 text-sm">مفيش تشغيلات لسه — ابدأ بالتحميص.</td></tr>
              )}
              {productions.map((p) => (
                <tr key={p.id} className={`border-b last:border-0 ${p.status === 'PENDING' ? 'bg-amber-50/40 border-amber-100' : p.wasteExceeded ? 'bg-red-50/70 border-red-100 hover:bg-red-50' : 'border-gray-50 hover:bg-gray-50/50'}`}>
                  <td className="p-3 font-bold tabular-nums text-[#0f3460]">
                    {p.batchNo || p.orderNo.slice(0, 12)}
                    {p.status === 'PENDING' && <span className="block text-[9px] text-amber-700 font-bold mt-0.5">⏳ بانتظار الإقفال</span>}
                    {p.status === 'COMPLETED' && p.wasteExceeded && <span className="block text-[9px] text-red-600 font-bold mt-0.5">⚠ هدر أعلى من الحد</span>}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STAGE_COLORS[p.stage] || 'bg-gray-100 text-gray-600'}`}>{p.stage}</span>
                    {p.roastLevel && <span className="text-[10px] text-gray-400 mr-1">{p.roastLevel}</span>}
                    {p.grindType && <span className="text-[10px] text-gray-400 mr-1">{p.grindType}</span>}
                  </td>
                  <td className="p-3 text-xs text-gray-600 max-w-[220px] truncate">{p.output || p.stageDetail}</td>
                  <td className="p-3 tabular-nums text-gray-500">{fmt(p.inputWeight)}</td>
                  <td className="p-3 tabular-nums font-semibold">{fmt(p.outputWeight)}</td>
                  <td className="p-3 tabular-nums">
                    {p.wasteWeight > 0 ? (
                      <span className="text-red-600 font-semibold flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> {fmt(p.wasteWeight)} ({fmt(p.wastePercent)}%)</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="p-3 text-xs text-gray-500">{p.channel}</td>
                  <td className="p-3 text-xs text-gray-400 tabular-nums">{timeOf(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ===== تشغيلات مفتوحة: العامل يرجع يقفلها بوزن الناتج ===== */
function PendingBatches({ productions, onDone }: { productions: ProdT[]; onDone: () => void }) {
  const pending = productions.filter((p) => p.status === 'PENDING')
  if (pending.length === 0) return null
  return (
    <div className="bg-white rounded-xl shadow-sm ring-2 ring-amber-200 overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3 bg-amber-50">
        <TriangleAlert className="w-5 h-5 text-amber-600" />
        <h3 className="text-base font-bold text-amber-800">تشغيلات مفتوحة — بانتظار وزن الناتج ({pending.length})</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {pending.map((p) => <PendingRow key={p.id} p={p} onDone={onDone} />)}
      </div>
    </div>
  )
}

function PendingRow({ p, onDone }: { p: ProdT; onDone: () => void }) {
  const [out, setOut] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const outN = Number(out) || 0
  const waste = outN > 0 ? p.inputWeight - outN : 0
  const wastePct = outN > 0 ? (waste / p.inputWeight) * 100 : 0
  const endpoint = p.stage === 'تحميص' ? 'roast' : 'blend'

  const complete = async () => {
    setErr('')
    if (!(outN > 0)) return setErr('اكتب الوزن الفعلي للناتج')
    if (outN > p.inputWeight) return setErr(`الوزن الخارج مينفعش يزيد عن الداخل (${p.inputWeight})`)
    setLoading(true)
    const res = await fetch(`/api/factory/${endpoint}/${p.id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outputKg: outN }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) return setErr(data.error || 'حصل خطأ')
    onDone()
  }

  const openedMin = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 60000)
  const openedTxt = openedMin < 60 ? `${openedMin} د` : `${Math.floor(openedMin / 60)}س ${openedMin % 60}د`

  return (
    <div className="p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm text-[#1a1a2e] flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.stage === 'تحميص' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{p.stage}</span>
            <span className="tabular-nums text-[#0f3460]">{p.batchNo}</span>
            <span className="text-xs text-gray-500 font-normal">· دخل {p.inputWeight} كجم · مفتوحة من {openedTxt}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{p.stageDetail}</p>
        </div>
      </div>
      {err && <div className="bg-red-50 text-red-600 p-2 rounded text-xs">{err}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number" min="1" step="1" max={p.inputWeight}
          value={out} onChange={(e) => setOut(e.target.value)}
          placeholder="وزن الناتج الفعلي (كجم)"
          className="flex-1 min-w-[180px] px-3 py-2 border border-amber-300 rounded-lg text-sm tabular-nums bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {outN > 0 && (
          <div className={`px-3 py-2 rounded-lg text-xs font-bold tabular-nums ${wastePct > 20 ? 'bg-red-50 text-red-700' : wastePct > 10 ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
            هدر متوقع: {fmt(waste)} كجم ({fmt(wastePct)}%)
          </div>
        )}
        <button onClick={complete} disabled={loading || outN <= 0} className="bg-green-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-green-700 disabled:opacity-50 shrink-0">
          {loading ? 'جاري الإقفال...' : 'إقفال التشغيلة'}
        </button>
      </div>
    </div>
  )
}

/* ===== المرحلة ١: التحميص ===== */
function RoastForm({ greens, onDone }: { greens: GreenT[]; onDone: () => void }) {
  const [greenId, setGreenId] = useState('')
  const [degree, setDegree] = useState('')
  const [inKg, setInKg] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const green = greens.find((g) => g.id === greenId)
  const inN = Number(inKg) || 0
  const expected = green && inN > 0 ? inN * (1 - green.roastLoss / 100) : 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!greenId || !degree || inN <= 0) { setError('اختار البن والدرجة واكتب وزن الأخضر الداخل'); return }
    setLoading(true)
    const res = await fetch('/api/factory/roast', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ greenProductId: greenId, roastDegree: degree, inputKg: inN, channel }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setGreenId(''); setDegree(''); setInKg(''); onDone()
  }

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">١</span>
        <Flame className="w-5 h-5 text-orange-500" /> بدء التحميص <span className="text-[10px] font-normal text-gray-400">(الأخضر يتخصم فورًا، ترجع تقفل بعدين)</span>
      </h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <select value={greenId} onChange={(e) => setGreenId(e.target.value)} className={inputCls}>
        <option value="">اختار البن الأخضر</option>
        {greens.map((g) => <option key={g.id} value={g.id}>{g.name} (متاح {g.quantity} كجم · خسران متوقع {g.roastLoss}%)</option>)}
      </select>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">درجة التحميص</label>
        <div className="grid grid-cols-4 gap-1.5">
          {ROAST_DEGREES.map((d) => (
            <button key={d} type="button" onClick={() => setDegree(d)} className={`px-2 py-2 rounded-lg text-xs font-bold transition ${degree === d ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{d}</button>
          ))}
        </div>
      </div>

      <input type="number" min="1" step="1" value={inKg} onChange={(e) => setInKg(e.target.value)} placeholder="وزن الأخضر الداخل (كجم)" className={inputCls} />
      <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
        {CHANNELS.map((c) => <option key={c} value={c}>القناة: {c}</option>)}
      </select>

      {inN > 0 && expected > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">متوقع الخروج (خسران {green!.roastLoss}%)</span><span className="tabular-nums font-semibold">{fmt(expected)} كجم</span></div>
          <p className="text-[10px] text-gray-400 mt-1">الهدر الفعلي هيتحسب بعد ما ترجع وتقفل التشغيلة بوزن الناتج.</p>
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50">
        {loading ? 'جاري البدء...' : 'بدء التحميص (فتح تشغيلة)'}
      </button>
    </form>
  )
}

/* ===== المرحلة ٢: طحن وتوليف (خطوة واحدة) ===== */
function GrindAndBlendForm({ blends, onDone }: { blends: BlendT[]; onDone: () => void }) {
  const [blendId, setBlendId] = useState('')
  const [planned, setPlanned] = useState('')
  const [fineness, setFineness] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const blend = blends.find((b) => b.id === blendId)
  const outN = Number(planned) || 0
  const activeComps = (blend?.components || []).filter((c) => c.percent > 0)
  const pctSum = +activeComps.reduce((s, c) => s + c.percent, 0).toFixed(3)
  const pctOk = pctSum === 100

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!blendId || outN <= 0 || !fineness) { setError('اختار التوليفة والكمية المخطط طحنها ودرجة النعومة'); return }
    if (!pctOk) { setError(`مجموع نسب الوصفة = ${pctSum}% — لازم يساوي 100% بالظبط (عدّلها من بنك الأصناف)`); return }
    setLoading(true)
    const res = await fetch('/api/factory/blend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blendId, plannedKg: outN, fineness, channel }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setBlendId(''); setPlanned(''); setFineness(''); onDone()
  }

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-black flex items-center justify-center">٢</span>
        <Wheat className="w-5 h-5 text-purple-600" /> بدء الطحن والتوليف <span className="text-[10px] font-normal text-gray-400">(المدخلات تتخصم فورًا، ترجع تقفل بوزن الناتج)</span>
      </h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      <select value={blendId} onChange={(e) => setBlendId(e.target.value)} className={inputCls}>
        <option value="">اختار التوليفة</option>
        {blends.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">درجة النعومة</label>
        <div className="grid grid-cols-4 gap-1.5">
          {GRIND_LEVELS.map((d) => (
            <button key={d} type="button" onClick={() => setFineness(d)} className={`px-1 py-2 rounded-lg text-[11px] font-bold transition ${fineness === d ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{d}</button>
          ))}
        </div>
      </div>

      <input type="number" min="1" step="1" value={planned} onChange={(e) => setPlanned(e.target.value)} placeholder="الكمية المخطط طحنها (كجم)" className={inputCls} />
      <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
        {CHANNELS.map((c) => <option key={c} value={c}>القناة: {c}</option>)}
      </select>

      {blend && (
        <div className={`rounded-lg p-3 text-xs space-y-1 ${pctOk ? 'bg-gray-50' : 'bg-red-50 border border-red-200'}`}>
          {activeComps.map((c, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {c.percent}%{' '}
                {c.kind === 'GREEN' && <span>بن محمص {c.roastDegree || 'وسط'} <span className="text-gray-500">({c.name})</span></span>}
                {c.kind === 'ROASTED' && <span className="text-orange-700">{c.name} <span className="text-[10px] text-gray-400">(جاهز)</span></span>}
                {c.kind === 'FLAVOR' && <span>{c.name} <span className="text-pink-600 text-[10px]">· نكهة</span></span>}
                {c.kind === 'SPICE' && <span>{c.name} <span className="text-purple-600 text-[10px]">· عطارة</span></span>}
              </span>
              {outN > 0 && <span className="tabular-nums font-semibold">{fmt((outN * c.percent) / 100)} كجم</span>}
            </div>
          ))}
          <div className={`flex justify-between border-t pt-1 font-bold ${pctOk ? 'text-green-700 border-gray-200' : 'text-red-600 border-red-200'}`}>
            <span>مجموع نسب الوصفة</span><span className="tabular-nums">{pctSum}% {pctOk ? '✓' : '✗ لازم 100%'}</span>
          </div>
        </div>
      )}
      {blend && blend.components.length === 0 && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 p-2.5 rounded-lg text-xs"><TriangleAlert className="w-4 h-4" /> التوليفة دي ملهاش وصفة — عرّفها في بنك الأصناف.</div>
      )}
      <p className="text-[10px] text-gray-400">المدخلات بتتخصم من مخزون <b>المحمص بدرجته</b> فور البدء. الوزن الفعلي للناتج بيتحدد بعد ما ترجع وتقفل التشغيلة (الهدر بيتحسب ساعتها).</p>

      <button type="submit" disabled={loading || (blend && !pctOk) || false} className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50">
        {loading ? 'جاري البدء...' : 'بدء الطحن والتوليف (فتح تشغيلة)'}
      </button>
    </form>
  )
}


/* ===== المرحلة ٤: التعبئة والتغليف ===== */
function PackFinished({ finished, onDone }: { finished: FinishedT[]; onDone: () => void }) {
  const [finishedId, setFinishedId] = useState('')
  const [boxes, setBoxes] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [actualCoffee, setActualCoffee] = useState('') // وزن البن المصروف الفعلي على الخط (كجم)
  const [waste, setWaste] = useState('') // الهدر (كجم)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fin = finished.find((f) => f.id === finishedId)
  const nBoxes = Number(boxes) || 0
  const pieces = fin ? fin.piecesPerBox * nBoxes : 0
  const netGram = fin ? Math.max(0, fin.gramsPerPiece - fin.tare) : 0
  const coffeeKg = (netGram * pieces) / 1000 // النظري المطلوب من البن الصافي

  // ===== تحقّق التعبئة (كشف العجز/غلط بشري) =====
  const tareKg = fin ? (pieces * fin.tare) / 1000 : 0 // وزن الأكياس الفارغة
  const actual = Number(actualCoffee) || 0
  const wasteKg = Number(waste) || 0
  const netUsed = actual > 0 ? actual - tareKg - wasteKg : null // الصافي الفعلي من البن
  const diff = netUsed !== null ? netUsed - coffeeKg : null // الفرق (سالب = عجز)
  const diffPct = diff !== null && coffeeKg > 0 ? (diff / coffeeKg) * 100 : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!finishedId || nBoxes <= 0) { setError('اختار المنتج وعدد العلب'); return }
    setLoading(true)
    const res = await fetch('/api/factory/pack', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finishedId, boxes: nBoxes, channel, wasteKg, actualCoffeeKg: actual || undefined }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setFinishedId(''); setBoxes(''); setActualCoffee(''); setWaste(''); onDone()
  }

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">٤</span>
        <Package className="w-5 h-5 text-[#0f3460]" /> التعبئة والتغليف <span className="text-xs font-normal text-gray-400">(مطحون ← عبوات ← مخزن المنتجات)</span>
      </h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <select value={finishedId} onChange={(e) => setFinishedId(e.target.value)} className={inputCls}>
          <option value="">اختار المنتج النهائي</option>
          {finished.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input type="number" min="1" value={boxes} onChange={(e) => setBoxes(e.target.value)} placeholder="عدد العلب" className={inputCls} />
      </div>
      <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
        {CHANNELS.map((c) => <option key={c} value={c}>القناة: {c}</option>)}
      </select>

      {fin && nBoxes > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">التوليفة</span><span className="font-semibold">{fin.blendName || '؟'}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">بن مستهلك ({fmt(netGram)}جم × {pieces} قطعة)</span><span className="font-semibold tabular-nums text-amber-700">{fmt(coffeeKg)} كجم</span></div>
          {fin.packagingName && <div className="flex justify-between"><span className="text-gray-500">تغليف مستهلك ({fin.packagingName})</span><span className="font-semibold tabular-nums">{pieces} قطعة</span></div>}
          <div className="flex justify-between border-t border-gray-200 pt-1"><span className="font-bold">الناتج</span><span className="font-bold tabular-nums text-green-700">{nBoxes} علبة</span></div>
        </div>
      )}
      {fin && !fin.hasBlend && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 p-2.5 rounded-lg text-xs"><TriangleAlert className="w-4 h-4" /> المنتج مش مربوط بتوليفة — اربطه في بنك الأصناف.</div>
      )}

      {/* تحقّق التعبئة — كشف العجز/الغلط البشري */}
      {fin && nBoxes > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-500">تحقّق التعبئة (اختياري) — اكتب وزن البن المصروف على الخط عشان نكشف أي عجز</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" step="0.01" value={actualCoffee} onChange={(e) => setActualCoffee(e.target.value)} placeholder="وزن البن المصروف (كجم)" className={inputCls} />
            <input type="number" min="0" step="0.01" value={waste} onChange={(e) => setWaste(e.target.value)} placeholder="هدر (كجم)" className={inputCls} />
          </div>
          {netUsed !== null && (
            <div className="bg-gray-50 rounded-lg p-2.5 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">الفارغة ({pieces} كيس × {fmt(fin.tare)}جم)</span><span className="tabular-nums">{fmt(tareKg)} كجم</span></div>
              <div className="flex justify-between"><span className="text-gray-500">الصافي الفعلي (مصروف − فارغة − هدر)</span><span className="font-semibold tabular-nums">{fmt(netUsed)} كجم</span></div>
              <div className="flex justify-between"><span className="text-gray-500">النظري المطلوب</span><span className="font-semibold tabular-nums">{fmt(coffeeKg)} كجم</span></div>
              <div className={`flex justify-between border-t border-gray-200 pt-1 font-bold ${diffPct !== null && diffPct < -2 ? 'text-red-600' : diffPct !== null && diffPct > 2 ? 'text-amber-600' : 'text-green-600'}`}>
                <span>{diff! < 0 ? 'عجز' : diff! > 0 ? 'زيادة' : 'مطابق'}</span>
                <span className="tabular-nums">{diff! > 0 ? '+' : ''}{fmt(diff!)} كجم ({diffPct !== null ? fmt(diffPct) : 0}%)</span>
              </div>
            </div>
          )}
          {diffPct !== null && diffPct < -2 && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 p-2.5 rounded-lg text-xs font-semibold">
              <TriangleAlert className="w-4 h-4 shrink-0" /> في عجز {fmt(Math.abs(diff!))} كجم — غالبًا غلط بشري (بن ناقص أو تسريب). راجع قبل الاعتماد.
            </div>
          )}
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50">
        {loading ? 'جاري التنفيذ...' : 'تنفيذ التعبئة'}
      </button>
    </form>
  )
}
