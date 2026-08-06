'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Package, TriangleAlert, Wheat, Factory, TrendingDown, Plus, X, ArrowRight, Clock, ChevronDown, ChevronUp, Activity } from 'lucide-react'
import { SearchableSelect } from '@/components/searchable-select'

interface GreenT { id: string; name: string; quantity: number; roastLoss: number }
interface BlendComp { name: string; kind: string; percent: number; roastDegree: string | null; perKilo: number; unit: string }
interface BlendT { id: string; name: string; quantity: number; components: BlendComp[] }
interface FinishedT { id: string; name: string; blendName: string | null; hasBlend: boolean; gramsPerPiece: number; piecesPerBox: number; tare: number; packagingName: string | null }
interface IngredientT { id: string; name: string; quantity: number; kind: 'ROASTED' | 'FLAVOR' | 'SPICE' }

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

type ModalView = null | 'roast' | 'blend' | 'pack'

const CHANNELS = ['المصنع', 'حلوان (الكافيه)', 'عبدالله (تحميص أجرة)']
const ROAST_DEGREES = ['فاتح', 'وسط', 'غامق', 'محروق']
const GRIND_LEVELS = ['ناعم جداً', 'ناعم', 'متوسط', 'خشن']
const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm bg-white'
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const timeOf = (iso: string) => new Date(iso).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const STAGE_COLORS: Record<string, string> = {
  تحميص: 'bg-orange-100 text-orange-700',
  'طحن وتوليف': 'bg-purple-100 text-purple-700',
  تعبئة: 'bg-blue-100 text-blue-700',
}

const KIND_LABELS: Record<string, { label: string; cls: string }> = {
  ROASTED: { label: 'بن محمص', cls: 'text-orange-700' },
  FLAVOR: { label: 'نكهة', cls: 'text-pink-600' },
  SPICE: { label: 'عطارة', cls: 'text-purple-600' },
}

/* ===== المودال الكامل ===== */
function FullScreenModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition">
          <ArrowRight className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-sm text-gray-500">رجوع لخط التصنيع</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export function FactoryProduction({ greens, blends, finished, availableIngredients, productions, kpi }: {
  greens: GreenT[]; blends: BlendT[]; finished: FinishedT[]
  availableIngredients: IngredientT[]
  productions: ProdT[]; kpi: KpiT
}) {
  const router = useRouter()
  const [activeModal, setActiveModal] = useState<ModalView>(null)
  const [logExpanded, setLogExpanded] = useState(true)
  const onDone = () => { setActiveModal(null); router.refresh() }

  const packedNet = Math.max(0, kpi.packCoffee - kpi.packWaste)
  const totalWaste = kpi.roastWaste + kpi.grindWaste + kpi.packWaste
  const overallYield = kpi.greenIn > 0 ? (packedNet / kpi.greenIn) * 100 : 0

  const pending = productions.filter((p) => p.status === 'PENDING')
  const completed = productions.filter((p) => p.status !== 'PENDING')

  return (
    <div className="space-y-6">
      {/* ===== خط الإنتاج — المراحل الثلاث ===== */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-[#0f3460]" />
            <h2 className="text-sm font-bold text-[#1a1a2e]">مراحل الإنتاج</h2>
          </div>
          <p className="text-xs text-gray-400">اختار مرحلة لبدء تشغيلة جديدة</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-gray-100">
          {/* التحميص */}
          <button
            onClick={() => setActiveModal('roast')}
            className="group p-4 sm:p-5 hover:bg-orange-50/50 transition-colors text-right"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#1a1a2e]">التحميص</h3>
                <p className="text-[11px] text-gray-400">بن أخضر → محمص</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors rotate-180" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-orange-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-orange-600/70">دخل</p>
                <p className="text-sm font-bold text-orange-700 tabular-nums">{fmt(kpi.greenIn)} <span className="text-[10px] font-normal">كجم</span></p>
              </div>
              <div className="bg-orange-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-orange-600/70">هدر</p>
                <p className="text-sm font-bold text-orange-700 tabular-nums">{fmt(kpi.roastWaste)} <span className="text-[10px] font-normal">كجم</span></p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 tabular-nums">{kpi.roastCount} تشغيلة · {kpi.greenIn > 0 ? `${fmt((kpi.roastWaste / kpi.greenIn) * 100)}% هدر` : '—'}</p>
          </button>

          {/* التوليف والطحن */}
          <button
            onClick={() => setActiveModal('blend')}
            className="group p-4 sm:p-5 hover:bg-purple-50/50 transition-colors text-right"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                <Wheat className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#1a1a2e]">التوليف والطحن</h3>
                <p className="text-[11px] text-gray-400">خلط وطحن المحمص</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-purple-500 transition-colors rotate-180" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-purple-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-purple-600/70">دخل</p>
                <p className="text-sm font-bold text-purple-700 tabular-nums">{fmt(kpi.grindIn)} <span className="text-[10px] font-normal">كجم</span></p>
              </div>
              <div className="bg-purple-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-purple-600/70">هدر</p>
                <p className="text-sm font-bold text-purple-700 tabular-nums">{fmt(kpi.grindWaste)} <span className="text-[10px] font-normal">كجم</span></p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 tabular-nums">{kpi.grindIn > 0 ? `${fmt((kpi.grindWaste / kpi.grindIn) * 100)}% هدر` : 'لا يوجد تشغيلات'}</p>
          </button>

          {/* التعبئة */}
          <button
            onClick={() => setActiveModal('pack')}
            className="group p-4 sm:p-5 hover:bg-blue-50/50 transition-colors text-right"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0f3460] to-[#16213e] flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#1a1a2e]">التعبئة والتغليف</h3>
                <p className="text-[11px] text-gray-400">مطحون → أكياس وعبوات</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#0f3460] transition-colors rotate-180" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-blue-600/70">معبأ صافي</p>
                <p className="text-sm font-bold text-blue-700 tabular-nums">{fmt(packedNet)} <span className="text-[10px] font-normal">كجم</span></p>
              </div>
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-blue-600/70">عبوات</p>
                <p className="text-sm font-bold text-blue-700 tabular-nums">{fmt(kpi.packUnits)} <span className="text-[10px] font-normal">عبوة</span></p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 tabular-nums">{kpi.packCoffee > 0 ? `هدر ${fmt(kpi.packWaste)} كجم` : 'لا يوجد تشغيلات'}</p>
          </button>
        </div>

        {/* شريط كفاءة الخط */}
        {kpi.greenIn > 0 && (
          <div className="border-t border-gray-100 px-4 sm:px-5 py-3 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${overallYield >= 80 ? 'bg-green-500' : overallYield >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">كفاءة الخط الإجمالية</span>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-bold tabular-nums ${overallYield >= 80 ? 'text-green-700' : overallYield >= 60 ? 'text-amber-700' : 'text-red-600'}`}>{fmt(overallYield)}%</span>
              <span className="text-[11px] text-gray-400 tabular-nums">هدر إجمالي {fmt(totalWaste)} كجم</span>
            </div>
          </div>
        )}
      </div>

      {/* ===== تشغيلات مفتوحة ===== */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm ring-2 ring-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 bg-amber-50 border-b border-amber-100">
            <TriangleAlert className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800 flex-1">تشغيلات مفتوحة — بانتظار الإقفال</h3>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full tabular-nums">{pending.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {pending.map((p) => <PendingRow key={p.id} p={p} onDone={() => router.refresh()} />)}
          </div>
        </div>
      )}

      {/* ===== سجل التشغيلات ===== */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setLogExpanded(!logExpanded)}
          className="w-full flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
        >
          <Factory className="w-4 h-4 text-[#0f3460]" />
          <h3 className="text-sm font-bold text-[#1a1a2e] flex-1 text-right">سجل التشغيلات</h3>
          <span className="text-xs text-gray-400 tabular-nums">{productions.length} تشغيلة</span>
          {logExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {logExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
                  <th className="px-4 py-2.5 font-medium">التشغيلة</th>
                  <th className="px-4 py-2.5 font-medium">المرحلة</th>
                  <th className="px-4 py-2.5 font-medium">الناتج</th>
                  <th className="px-4 py-2.5 font-medium">داخل</th>
                  <th className="px-4 py-2.5 font-medium">خارج</th>
                  <th className="px-4 py-2.5 font-medium">هدر</th>
                  <th className="px-4 py-2.5 font-medium">القناة</th>
                  <th className="px-4 py-2.5 font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {productions.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">لا يوجد تشغيلات بعد — ابدأ بالتحميص</td></tr>
                )}
                {productions.map((p) => (
                  <tr key={p.id} className={`border-b last:border-0 transition-colors ${p.status === 'PENDING' ? 'bg-amber-50/40 border-amber-100' : p.wasteExceeded ? 'bg-red-50/50 border-red-100 hover:bg-red-50' : 'border-gray-50 hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3">
                      <span className="font-bold tabular-nums text-[#0f3460] text-xs">{p.batchNo || p.orderNo.slice(0, 12)}</span>
                      {p.status === 'PENDING' && <span className="block text-[9px] text-amber-700 font-bold mt-0.5">⏳ بانتظار الإقفال</span>}
                      {p.status === 'COMPLETED' && p.wasteExceeded && <span className="block text-[9px] text-red-600 font-bold mt-0.5">⚠ هدر مرتفع</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${STAGE_COLORS[p.stage] || 'bg-gray-100 text-gray-600'}`}>{p.stage}</span>
                      {p.roastLevel && <span className="text-[10px] text-gray-400 mr-1">{p.roastLevel}</span>}
                      {p.grindType && <span className="text-[10px] text-gray-400 mr-1">{p.grindType}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate" title={p.output || p.stageDetail}>{p.output || p.stageDetail}</td>
                    <td className="px-4 py-3 tabular-nums text-xs text-gray-500">{fmt(p.inputWeight)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs font-semibold">{fmt(p.outputWeight)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">
                      {p.wasteWeight > 0 ? (
                        <span className="text-red-600 font-semibold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> {fmt(p.wasteWeight)} ({fmt(p.wastePercent)}%)</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{p.channel}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{timeOf(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== المودالات ===== */}
      <FullScreenModal open={activeModal === 'roast'} onClose={() => setActiveModal(null)}>
        <RoastForm greens={greens} onDone={onDone} />
      </FullScreenModal>

      <FullScreenModal open={activeModal === 'blend'} onClose={() => setActiveModal(null)}>
        <GrindAndBlendForm blends={blends} availableIngredients={availableIngredients} onDone={onDone} />
      </FullScreenModal>

      <FullScreenModal open={activeModal === 'pack'} onClose={() => setActiveModal(null)}>
        <PackForm blends={blends} finished={finished} onDone={onDone} />
      </FullScreenModal>
    </div>
  )
}

/* ===== تشغيلات مفتوحة: العامل يرجع يقفلها ===== */
function PendingRow({ p, onDone }: { p: ProdT; onDone: () => void }) {
  const [out, setOut] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const outN = Number(out) || 0
  const waste = outN > 0 ? p.inputWeight - outN : 0
  const wastePct = outN > 0 ? (waste / p.inputWeight) * 100 : 0
  const isPack = p.stage === 'تعبئة'
  const endpoint = p.stage === 'تحميص' ? 'roast' : isPack ? 'pack' : 'blend'

  const complete = async () => {
    setErr('')
    if (!(outN > 0)) return setErr(isPack ? 'اكتب عدد الأكياس/العبوات الفعلية' : 'اكتب الوزن الفعلي للناتج')
    if (!isPack && outN > p.inputWeight) return setErr(`الوزن الخارج مينفعش يزيد عن الداخل (${p.inputWeight})`)
    setLoading(true)
    const body = isPack ? { actualBags: outN } : { outputKg: outN }
    const res = await fetch(`/api/factory/${endpoint}/${p.id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) return setErr(data.error || 'حصل خطأ')
    onDone()
  }

  const openedMin = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 60000)
  const openedTxt = openedMin < 60 ? `${openedMin} د` : `${Math.floor(openedMin / 60)}س ${openedMin % 60}د`

  const stageIcon = p.stage === 'تحميص' ? <Flame className="w-4 h-4" /> : p.stage === 'تعبئة' ? <Package className="w-4 h-4" /> : <Wheat className="w-4 h-4" />
  const stageColor = p.stage === 'تحميص' ? 'text-orange-600 bg-orange-100' : p.stage === 'تعبئة' ? 'text-blue-600 bg-blue-100' : 'text-purple-600 bg-purple-100'

  return (
    <div className="p-4 sm:px-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stageColor}`}>{stageIcon}</div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#1a1a2e] flex items-center gap-1.5">
              <span className="tabular-nums">{p.batchNo}</span>
              <span className="text-[10px] text-gray-400 font-normal">· {p.stage}</span>
            </p>
            <p className="text-xs text-gray-500 truncate">{p.stageDetail}</p>
            {p.outputProductName && isPack && <p className="text-xs text-blue-600 font-semibold">المنتج: {p.outputProductName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[11px] tabular-nums">{openedTxt}</span>
          <span className="text-[11px]">· {p.inputWeight} كجم</span>
        </div>
      </div>

      {err && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{err}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text" inputMode="decimal" dir="ltr" min="1" step="1" max={isPack ? undefined : p.inputWeight}
          value={out} onChange={(e) => setOut(e.target.value)}
          placeholder={isPack ? 'عدد الأكياس الفعلية' : 'وزن الناتج الفعلي (كجم)'}
          className="flex-1 min-w-[160px] px-3 py-2.5 border border-amber-300 rounded-xl text-sm tabular-nums bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {outN > 0 && !isPack && (
          <div className={`px-3 py-2 rounded-lg text-[11px] font-bold tabular-nums ${wastePct > 20 ? 'bg-red-50 text-red-700' : wastePct > 10 ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
            هدر: {fmt(waste)} كجم ({fmt(wastePct)}%)
          </div>
        )}
        {outN > 0 && isPack && (
          <div className="px-3 py-2 rounded-lg text-[11px] font-bold tabular-nums bg-blue-50 text-blue-700">
            {outN} كيس
          </div>
        )}
        <button onClick={complete} disabled={loading || outN <= 0} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 shrink-0 transition-colors">
          {loading ? 'جاري...' : 'إقفال'}
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
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
          <Flame className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">بدء عملية التحميص</h2>
          <p className="text-xs text-gray-500">رقم التشغيلة وتاريخها بيتاخدوا أوتوماتيك</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>}

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">البن الأخضر</label>
        <SearchableSelect
          value={greenId}
          onChange={setGreenId}
          placeholder="اختار البن الأخضر"
          className={inputCls}
          options={greens.map((g) => ({ value: g.id, label: g.name, sublabel: `متاح ${g.quantity} كجم · خسران متوقع ${g.roastLoss}%` }))}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">درجة التحميص</label>
        <div className="grid grid-cols-4 gap-2">
          {ROAST_DEGREES.map((d) => (
            <button key={d} type="button" onClick={() => setDegree(d)} className={`px-3 py-3 rounded-xl text-sm font-bold transition ${degree === d ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{d}</button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">وزن الأخضر الداخل (كجم)</label>
        <input type="text" inputMode="decimal" dir="ltr" min="1" step="1" value={inKg} onChange={(e) => setInKg(e.target.value)} placeholder="اكتب الوزن" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">القناة</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {inN > 0 && expected > 0 && (
        <div className="bg-orange-50 rounded-xl p-4 space-y-1">
          <div className="flex justify-between text-sm"><span className="text-gray-600">متوقع الخروج (خسران {green!.roastLoss}%)</span><span className="tabular-nums font-bold text-orange-700">{fmt(expected)} كجم</span></div>
          <p className="text-xs text-gray-400">الهدر الفعلي هيتحسب بعد ما ترجع وتقفل التشغيلة بوزن الناتج.</p>
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-base hover:bg-orange-600 disabled:opacity-50 shadow-lg transition">
        {loading ? 'جاري البدء...' : 'بدء التحميص (فتح تشغيلة)'}
      </button>
    </form>
  )
}

/* ===== المرحلة ٢: طحن وتوليف ===== */
function GrindAndBlendForm({ blends, availableIngredients, onDone }: { blends: BlendT[]; availableIngredients: IngredientT[]; onDone: () => void }) {
  const [mode, setMode] = useState<'recipe' | 'custom'>('recipe')
  const [blendId, setBlendId] = useState('')
  const [planned, setPlanned] = useState('')
  const [fineness, setFineness] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [customName, setCustomName] = useState('')
  const [customComps, setCustomComps] = useState<{ productId: string; percent: string }[]>([{ productId: '', percent: '' }])

  const blend = blends.find((b) => b.id === blendId)
  const outN = Number(planned) || 0

  const activeComps = (blend?.components || []).filter((c) => c.percent > 0)
  const pctSum = +activeComps.reduce((s, c) => s + c.percent, 0).toFixed(3)
  const pctOk = pctSum === 100

  const customPctSum = +customComps.reduce((s, c) => s + (Number(c.percent) || 0), 0).toFixed(3)
  const customPctOk = customPctSum === 100
  const validCustom = customComps.filter((c) => c.productId && Number(c.percent) > 0)

  const addComp = () => setCustomComps([...customComps, { productId: '', percent: '' }])
  const removeComp = (i: number) => setCustomComps(customComps.filter((_, j) => j !== i))
  const updateComp = (i: number, field: 'productId' | 'percent', value: string) =>
    setCustomComps(customComps.map((c, j) => j === i ? { ...c, [field]: value } : c))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (outN <= 0 || !fineness) { setError('اكتب الكمية المخطط طحنها واختار درجة النعومة'); return }
    if (mode === 'recipe') {
      if (!blendId) { setError('اختار التوليفة'); return }
      if (!pctOk) { setError(`مجموع نسب الوصفة = ${pctSum}% — لازم يساوي 100%`); return }
    } else {
      if (validCustom.length === 0) { setError('أضف مكوّن واحد على الأقل بنسبة'); return }
      if (!customPctOk) { setError(`مجموع نسب المكوّنات = ${customPctSum}% — لازم يساوي 100% بالظبط`); return }
    }

    setLoading(true)
    const body: any = { plannedKg: outN, fineness, channel }
    if (mode === 'recipe') {
      body.blendId = blendId
    } else {
      body.customBlend = true
      body.blendName = customName.trim() || undefined
      body.customComponents = validCustom.map((c) => ({ productId: c.productId, percent: Number(c.percent) }))
    }

    const res = await fetch('/api/factory/blend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setBlendId(''); setPlanned(''); setFineness(''); setCustomComps([{ productId: '', percent: '' }]); setCustomName('')
    setMode('recipe'); onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
          <Wheat className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">التوليف والطحن</h2>
          <p className="text-xs text-gray-500">رقم التشغيلة وتاريخها بيتاخدوا أوتوماتيك</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode('recipe')} className={`px-4 py-3 rounded-xl text-sm font-bold transition ${mode === 'recipe' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          توليفة جاهزة
        </button>
        <button type="button" onClick={() => setMode('custom')} className={`px-4 py-3 rounded-xl text-sm font-bold transition ${mode === 'custom' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          توليفة مخصصة
        </button>
      </div>

      {mode === 'recipe' && (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">التوليفة</label>
            <SearchableSelect
              value={blendId}
              onChange={setBlendId}
              placeholder="اختار التوليفة"
              className={inputCls}
              options={blends.map((b) => ({ value: b.id, label: b.name }))}
            />
          </div>

          {blend && (
            <div className={`rounded-xl p-4 text-sm space-y-1.5 ${pctOk ? 'bg-gray-50' : 'bg-red-50 border border-red-200'}`}>
              {activeComps.map((c, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {c.percent}%{' '}
                    <span className={KIND_LABELS[c.kind]?.cls || ''}>{c.name}</span>
                    {c.roastDegree && <span className="text-gray-400 text-xs"> ({c.roastDegree})</span>}
                    <span className="text-gray-400 text-xs"> · {KIND_LABELS[c.kind]?.label || c.kind}</span>
                  </span>
                  {outN > 0 && <span className="tabular-nums font-semibold">{fmt((outN * c.percent) / 100)} كجم</span>}
                </div>
              ))}
              <div className={`flex justify-between border-t pt-1.5 font-bold ${pctOk ? 'text-green-700 border-gray-200' : 'text-red-600 border-red-200'}`}>
                <span>المجموع</span><span className="tabular-nums">{pctSum}% {pctOk ? '✓' : '✗ لازم 100%'}</span>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'custom' && (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">اسم التوليفة (اختياري)</label>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="يتولّد تلقائي لو فاضي" className={inputCls} />
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-purple-700">خامات التوليف</label>
              <button type="button" onClick={addComp} className="flex items-center gap-1 text-sm text-purple-600 font-semibold hover:text-purple-800">
                <Plus className="w-4 h-4" /> إضافة مكوّن
              </button>
            </div>
            {customComps.map((c, i) => {
              const ing = availableIngredients.find((a) => a.id === c.productId)
              return (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      value={c.productId}
                      onChange={(v) => updateComp(i, 'productId', v)}
                      placeholder="اختار المكوّن"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
                      options={[
                        ...availableIngredients.filter((a) => a.kind === 'ROASTED').map((a) => ({ value: a.id, label: a.name, sublabel: `بن محمص · متاح ${a.quantity} كجم` })),
                        ...availableIngredients.filter((a) => a.kind === 'FLAVOR').map((a) => ({ value: a.id, label: a.name, sublabel: `نكهات · متاح ${a.quantity} كجم` })),
                        ...availableIngredients.filter((a) => a.kind === 'SPICE').map((a) => ({ value: a.id, label: a.name, sublabel: `عطارة · متاح ${a.quantity} كجم` })),
                      ]}
                    />
                  </div>
                  <div className="relative w-24 shrink-0">
                    <input type="text" inputMode="decimal" dir="ltr" min="0" max="100" step="0.1" value={c.percent} onChange={(e) => updateComp(i, 'percent', e.target.value)} placeholder="%" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm tabular-nums bg-white" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  {ing && outN > 0 && <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{fmt((outN * (Number(c.percent) || 0)) / 100)} كجم</span>}
                  {customComps.length > 1 && (
                    <button type="button" onClick={() => removeComp(i)} className="p-1.5 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  )}
                </div>
              )
            })}
            <div className={`flex justify-between text-sm font-bold pt-2 border-t ${customPctOk ? 'text-green-700 border-purple-200' : 'text-red-600 border-red-200'}`}>
              <span>المجموع</span><span className="tabular-nums">{customPctSum}% {customPctOk ? '✓' : '✗ لازم 100%'}</span>
            </div>
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">درجة النعومة</label>
        <div className="grid grid-cols-4 gap-2">
          {GRIND_LEVELS.map((d) => (
            <button key={d} type="button" onClick={() => setFineness(d)} className={`px-3 py-3 rounded-xl text-sm font-bold transition ${fineness === d ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{d}</button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">الكمية المخطط طحنها (كجم)</label>
        <input type="text" inputMode="decimal" dir="ltr" min="1" step="1" value={planned} onChange={(e) => setPlanned(e.target.value)} placeholder="اكتب الكمية" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">القناة</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <p className="text-xs text-gray-400">المدخلات بتتخصم فور البدء. الوزن الفعلي للناتج بيتحدد بعد ما ترجع وتقفل التشغيلة.</p>

      <button
        type="submit"
        disabled={loading || (mode === 'recipe' && blend && !pctOk) || (mode === 'custom' && !customPctOk) || false}
        className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-purple-700 disabled:opacity-50 shadow-lg transition"
      >
        {loading ? 'جاري البدء...' : 'بدء الطحن والتوليف (فتح تشغيلة)'}
      </button>
    </form>
  )
}

/* ===== المرحلة ٣: التعبئة والتغليف ===== */
function PackForm({ blends, finished, onDone }: {
  blends: BlendT[]; finished: FinishedT[]; onDone: () => void
}) {
  const [sourceId, setSourceId] = useState('')
  const [pullKg, setPullKg] = useState('')
  const [finishedId, setFinishedId] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const sourcesWithStock = blends.filter((b) => b.quantity > 0)
  const source = blends.find((b) => b.id === sourceId)
  const pullN = Number(pullKg) || 0
  const fin = finished.find((f) => f.id === finishedId)

  const expectedBags = fin && pullN > 0 && fin.gramsPerPiece > 0
    ? Math.floor((pullN * 1000) / (fin.gramsPerPiece + fin.tare))
    : 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!sourceId || pullN <= 0) { setError('اختار المنتج المطحون واكتب الكمية المسحوبة'); return }
    if (!finishedId) { setError('اختار المنتج النهائي'); return }
    if (source && pullN > source.quantity) { setError(`الكمية المسحوبة أكبر من المتاح (${source.quantity} كجم)`); return }

    setLoading(true)
    const res = await fetch('/api/factory/pack', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceProductId: sourceId, pullKg: pullN, finishedId, channel }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setSourceId(''); setPullKg(''); setFinishedId(''); onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
          <Package className="w-6 h-6 text-[#0f3460]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">التعبئة والتغليف</h2>
          <p className="text-xs text-gray-500">رقم التشغيلة وتاريخها بيتاخدوا أوتوماتيك</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>}

      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
        <label className="text-sm font-bold text-blue-700">١. سحب من مخزن المطحون</label>
        <SearchableSelect
          value={sourceId}
          onChange={setSourceId}
          placeholder="اختار المنتج المطحون"
          emptyText="مفيش مطحون متاح — لازم تعمل طحن وتوليف الأول"
          className={inputCls}
          options={sourcesWithStock.map((b) => ({ value: b.id, label: b.name, sublabel: `متاح ${b.quantity} كجم` }))}
        />
        <input type="text" inputMode="decimal" dir="ltr" min="0.1" step="0.1" value={pullKg} onChange={(e) => setPullKg(e.target.value)} placeholder="الكمية المسحوبة (كجم)" className={inputCls} />
        {source && pullN > 0 && pullN <= source.quantity && (
          <p className="text-xs text-green-600">✓ متاح {source.quantity} كجم — هيتبقى {fmt(source.quantity - pullN)} كجم</p>
        )}
        {source && pullN > source.quantity && (
          <p className="text-xs text-red-600">✗ الكمية أكبر من المتاح ({source.quantity} كجم)</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-bold text-gray-700">٢. المنتج النهائي (منتج البيع)</label>
        <SearchableSelect
          value={finishedId}
          onChange={setFinishedId}
          placeholder="اختار المنتج النهائي"
          className={inputCls}
          options={finished.map((f) => ({
            value: f.id,
            label: f.name,
            sublabel: `${f.gramsPerPiece} جم/كيس${f.packagingName ? ` · تغليف: ${f.packagingName}` : ''}`,
          }))}
        />
      </div>

      {fin && (
        <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-gray-500">وزن الكيس الصافي</span><span className="font-semibold tabular-nums">{fin.gramsPerPiece} جم</span></div>
          {fin.tare > 0 && <div className="flex justify-between"><span className="text-gray-500">وزن الفارغة (التغليف)</span><span className="tabular-nums">{fin.tare} جم</span></div>}
          {fin.packagingName && <div className="flex justify-between"><span className="text-gray-500">مادة التغليف</span><span className="tabular-nums">{fin.packagingName}</span></div>}
          {fin.blendName && <div className="flex justify-between"><span className="text-gray-500">التوليفة الأساسية</span><span className="tabular-nums">{fin.blendName}</span></div>}
          {pullN > 0 && (
            <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold text-blue-700">
              <span>عدد الأكياس المتوقع</span>
              <span className="tabular-nums">~{expectedBags} كيس</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">القناة</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <p className="text-xs text-gray-400">المدخلات (مطحون + تغليف) بتتخصم فور البدء. عدد الأكياس الفعلي بيتحدد بعد ما خط التعبئة يخلص وتقفل التشغيلة — الهدر بيتحسب أوتوماتيك.</p>

      <button type="submit" disabled={loading} className="w-full bg-[#0f3460] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#0a2545] disabled:opacity-50 shadow-lg transition">
        {loading ? 'جاري البدء...' : 'بدء التعبئة (فتح تشغيلة)'}
      </button>
    </form>
  )
}
