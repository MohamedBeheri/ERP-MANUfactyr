'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Blend, Package, Trash2, TriangleAlert } from 'lucide-react'

interface BlendComp { name: string; kind: string; percent: number; perKilo: number; roastLoss: number; unit: string }
interface BlendT { id: string; name: string; components: BlendComp[] }
interface FinishedT { id: string; name: string; blendName: string | null; hasBlend: boolean; gramsPerPiece: number; piecesPerBox: number; tare: number; packagingName: string | null }
interface ProdT { id: string; orderNo: string; stage: string; kind: string; output: string; inputWeight: number; wasteWeight: number; wastePercent: number; createdAt: string }

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const CHANNELS = ['المصنع', 'حلوان (الكافيه)', 'عبدالله (تحميص أجرة)']
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function FactoryProduction({ blends, finished, productions }: { blends: BlendT[]; finished: FinishedT[]; productions: ProdT[] }) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <ProduceBlend blends={blends} onDone={() => router.refresh()} />
        <PackFinished finished={finished} onDone={() => router.refresh()} />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-3">آخر أوامر التصنيع ({productions.length})</h3>
        {productions.length === 0 && <p className="text-sm text-gray-500">مفيش أوامر تصنيع لسه.</p>}
        <div className="space-y-2">
          {productions.map((p) => (
            <div key={p.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm flex items-center gap-2">
                  {p.kind === 'PACK' ? <Package className="w-4 h-4 text-[#0f3460]" /> : <Blend className="w-4 h-4 text-amber-600" />}
                  {p.stage}
                </p>
                <p className="text-[11px] text-gray-400 tabular-nums">
                  {p.orderNo} · {p.output}{p.wasteWeight > 0 ? ` · هدر ${p.wasteWeight} (${fmt(p.wastePercent)}%)` : ''}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm(`حذف أمر التصنيع ${p.orderNo}؟ هيرجّع المخزون لحالته.`)) return
                  const res = await fetch(`/api/factory/${p.id}`, { method: 'DELETE' })
                  if (res.ok) router.refresh(); else alert((await res.json().catch(() => ({}))).error || 'فشل الحذف')
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0"
                aria-label="حذف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProduceBlend({ blends, onDone }: { blends: BlendT[]; onDone: () => void }) {
  const [blendId, setBlendId] = useState('')
  const [outputKg, setOutputKg] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const blend = blends.find((b) => b.id === blendId)
  const out = Number(outputKg) || 0

  const rows = (blend?.components || []).map((c) => {
    const kg = c.kind === 'GREEN'
      ? (out * c.percent) / 100 / (c.roastLoss < 100 ? 1 - c.roastLoss / 100 : 1)
      : (out * c.perKilo) / 1000
    return { ...c, kg }
  })
  const totalInput = rows.reduce((s, r) => s + r.kg, 0)
  const waste = Math.max(0, totalInput - out)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!blendId || out <= 0) { setError('اختار التوليفة والكمية'); return }
    setLoading(true)
    const res = await fetch('/api/factory/produce-blend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blendId, outputKg: out, channel }) })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setBlendId(''); setOutputKg(''); onDone()
  }

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2"><Blend className="w-5 h-5 text-amber-600" /> إنتاج توليفة</h3>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <select value={blendId} onChange={(e) => setBlendId(e.target.value)} className={inputCls}>
          <option value="">اختار التوليفة</option>
          {blends.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="number" min="1" value={outputKg} onChange={(e) => setOutputKg(e.target.value)} placeholder="الكمية الناتجة (كجم)" className={inputCls} />
      </div>

      {blend && out > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] font-semibold text-gray-500 mb-2">المطلوب (البن الأخضر مضروب في الخسران + العطارة بالجرعة):</p>
          <div className="space-y-1">
            {rows.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span>{r.name}{r.kind === 'GREEN' ? ` (${r.percent}% · خسران ${r.roastLoss}%)` : ` (${r.perKilo} جم/كيلو)`}</span>
                <span className="font-semibold tabular-nums">{fmt(r.kg)} {r.unit}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs border-t border-gray-200 pt-1 mt-1">
              <span className="text-gray-500">إجمالي المدخل / الناتج / الهدر</span>
              <span className="font-bold tabular-nums">{fmt(totalInput)} / {out} / {fmt(waste)} كجم</span>
            </div>
          </div>
        </div>
      )}
      {blend && blend.components.length === 0 && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 p-2.5 rounded-lg text-xs"><TriangleAlert className="w-4 h-4" /> التوليفة دي ملهاش وصفة — عرّفها في بنك الأصناف.</div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-amber-500 text-white py-2.5 rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50">
        {loading ? 'جاري التنفيذ...' : 'تنفيذ إنتاج التوليفة'}
      </button>
    </form>
  )
}

function PackFinished({ finished, onDone }: { finished: FinishedT[]; onDone: () => void }) {
  const [finishedId, setFinishedId] = useState('')
  const [boxes, setBoxes] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fin = finished.find((f) => f.id === finishedId)
  const nBoxes = Number(boxes) || 0
  const pieces = fin ? fin.piecesPerBox * nBoxes : 0
  const netGram = fin ? Math.max(0, fin.gramsPerPiece - fin.tare) : 0
  const coffeeKg = (netGram * pieces) / 1000

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!finishedId || nBoxes <= 0) { setError('اختار المنتج وعدد العلب'); return }
    setLoading(true)
    const res = await fetch('/api/factory/pack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ finishedId, boxes: nBoxes, channel }) })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setFinishedId(''); setBoxes(''); onDone()
  }

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
      <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2"><Package className="w-5 h-5 text-[#0f3460]" /> تعبئة منتج نهائي</h3>
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

      <button type="submit" disabled={loading} className="w-full bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50">
        {loading ? 'جاري التنفيذ...' : 'تنفيذ التعبئة'}
      </button>
    </form>
  )
}
