'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Package, TriangleAlert, Wheat, Factory, TrendingDown, Plus, X, ArrowRight, Clock, ChevronDown, ChevronUp, Activity } from 'lucide-react'
import { SearchableSelect } from '@/components/searchable-select'

interface GreenT { id: string; name: string; quantity: number; roastLoss: number }
interface BlendComp { name: string; kind: string; percent: number; roastDegree: string | null; perKilo: number; unit: string }
interface BlendT { id: string; name: string; quantity: number; components: BlendComp[] }
interface FinishedT { id: string; name: string; blendName: string | null; hasBlend: boolean; gramsPerPiece: number; piecesPerBox: number; tare: number; packagingName: string | null; packagingId: string | null }
interface IngredientT { id: string; name: string; quantity: number; kind: 'ROASTED' | 'FLAVOR' | 'SPICE' }
interface PackagingT { id: string; name: string; quantity: number; tare: number; rollWeight: number; estTare: number; unit: string }

interface ProdT {
  id: string; orderNo: string; batchNo: string | null; stage: string; stageDetail: string
  roastLevel: string | null; grindType: string | null; output: string
  inputWeight: number; outputWeight: number; expectedOutput?: number | null; wasteWeight: number; wastePercent: number; wasteExceeded: boolean; channel: string; createdAt: string
  status: string; outputProductName: string | null
  gramsPerPiece?: number; rollInputKg?: number | null; rollName?: string | null; rollTare?: number; rollCore?: number
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

export function FactoryProduction({ greens, blends, finished, availableIngredients, packagings, productions, kpi }: {
  greens: GreenT[]; blends: BlendT[]; finished: FinishedT[]
  availableIngredients: IngredientT[]; packagings: PackagingT[]
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
                  <th className="px-4 py-2.5 font-medium">المتوقع</th>
                  <th className="px-4 py-2.5 font-medium">الفعلي</th>
                  <th className="px-4 py-2.5 font-medium">الانحراف</th>
                  <th className="px-4 py-2.5 font-medium">هدر</th>
                  <th className="px-4 py-2.5 font-medium">القناة</th>
                  <th className="px-4 py-2.5 font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {productions.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">لا يوجد تشغيلات بعد — ابدأ بالتحميص</td></tr>
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
                    <td className="px-4 py-3 tabular-nums text-xs text-gray-500">{p.expectedOutput != null && p.expectedOutput > 0 ? fmt(p.expectedOutput) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 tabular-nums text-xs font-semibold">{p.status === 'PENDING' ? <span className="text-amber-600">—</span> : fmt(p.outputWeight)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">
                      {(() => {
                        if (p.status === 'PENDING' || p.expectedOutput == null || !(p.expectedOutput > 0) || !(p.outputWeight > 0)) return <span className="text-gray-300">—</span>
                        const dev = ((p.outputWeight - p.expectedOutput) / p.expectedOutput) * 100
                        const abs = Math.abs(dev)
                        const cls = abs <= 5 ? 'text-green-700' : abs <= 15 ? 'text-amber-700' : 'text-red-600'
                        return <span className={`font-semibold ${cls}`}>{dev > 0 ? '+' : ''}{fmt(dev)}%</span>
                      })()}
                    </td>
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
        <PackForm blends={blends} finished={finished} packagings={packagings} onDone={onDone} />
      </FullScreenModal>
    </div>
  )
}

/* ===== تشغيلات مفتوحة: العامل يرجع يقفلها ===== */
function PendingRow({ p, onDone }: { p: ProdT; onDone: () => void }) {
  const [out, setOut] = useState('')
  const [remCoffee, setRemCoffee] = useState('') // وزن البن المتبقي الراجع للمخزن (كجم)
  const [remRoll, setRemRoll] = useState('')     // وزن الرول المتبقي الراجع للمخزن (كجم)
  const [coreG, setCoreG] = useState('')         // وزن الفارغة (كرتونة الرول) الفعلي جم — افتراضي من بنك الأصناف
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const outN = Number(out) || 0
  const waste = outN > 0 ? p.inputWeight - outN : 0
  const wastePct = outN > 0 ? (waste / p.inputWeight) * 100 : 0
  const isPack = p.stage === 'تعبئة'
  const endpoint = p.stage === 'تحميص' ? 'roast' : isPack ? 'pack' : 'blend'

  const rollInputKg = p.rollInputKg || 0
  const remCoffeeN = Number(remCoffee) || 0
  const remRollN = Number(remRoll) || 0
  // صافي البن في الكيس = الوزن الإجمالي للكيس المعبأ − وزن الكيس الفاضي (الفيلم)
  const netCoffeePerBagG = p.gramsPerPiece ? Math.max(0, p.gramsPerPiece - (p.rollTare || 0)) : 0
  // البن المستهلك فعلاً = المسحوب − المتبقي · اللي دخل الأكياس = عدد × صافي البن في الكيس
  const coffeeConsumed = Math.max(0, p.inputWeight - remCoffeeN)
  const coffeeInBags = outN > 0 && netCoffeePerBagG ? (outN * netCoffeePerBagG) / 1000 : 0
  // عدد الأكياس من الرول = (وزن الرول − وزن الفارغة/الكرتونة) ÷ وزن القطعة
  const bagsFromRoll = rollInputKg > 0 && p.rollTare ? Math.max(0, Math.floor((rollInputKg * 1000 - (p.rollCore || 0)) / (p.rollTare || 1))) : 0

  const complete = async () => {
    setErr('')
    if (!(outN > 0)) return setErr(isPack ? 'اكتب عدد الأكياس/العبوات الفعلية' : 'اكتب الوزن الفعلي للناتج')
    if (!isPack && outN > p.inputWeight) return setErr(`الوزن الخارج مينفعش يزيد عن الداخل (${p.inputWeight})`)
    if (isPack) {
      if (remCoffee.trim() !== '' && Number(remCoffee) > p.inputWeight) return setErr(`البن المتبقي مينفعش يزيد عن المسحوب (${p.inputWeight} كجم)`)
      if (remRoll.trim() !== '' && rollInputKg > 0 && Number(remRoll) > rollInputKg) return setErr(`الرول المتبقي مينفعش يزيد عن المسحوب (${rollInputKg} كجم)`)
    }
    setLoading(true)
    const body = isPack
      ? {
          actualBags: outN,
          remainingCoffeeKg: remCoffee.trim() !== '' ? Number(remCoffee) : 0,
          remainingRollKg: remRoll.trim() !== '' ? Number(remRoll) : 0,
          rollCoreWeightG: coreG.trim() !== '' ? Number(coreG) : (p.rollCore || 0),
        }
      : { outputKg: outN }
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

      {isPack ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600">عدد الأكياس الفعلية *</label>
              <input type="text" inputMode="decimal" dir="ltr" min="1" step="1" value={out} onChange={(e) => setOut(e.target.value)} placeholder="عدد" className="w-full px-3 py-2.5 border border-amber-300 rounded-xl text-sm tabular-nums bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600">وزن البن المتبقي (كجم)</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.001" value={remCoffee} onChange={(e) => setRemCoffee(e.target.value)} placeholder="راجع للمخزن" title="البن اللي فضل بعد التعبئة — بيرجع لمخزن المطحون" className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm tabular-nums bg-green-50/40 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600">وزن الرول المتبقي (كجم)</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.001" value={remRoll} onChange={(e) => setRemRoll(e.target.value)} placeholder="راجع للمخزن" title="الرول اللي فضل بعد التعبئة — بيرجع لمخزن الرول" className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm tabular-nums bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600">وزن الفارغة (كرتونة الرول) جم</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" value={coreG} onChange={(e) => setCoreG(e.target.value)} placeholder={p.rollCore ? `تقديري ${p.rollCore}` : 'جم'} title="وزن كرتونة الرول (هدر) — افتراضي من بنك الأصناف، عدّله لو قِسته فعليًا" className="w-full px-3 py-2.5 border border-red-200 rounded-xl text-sm tabular-nums bg-red-50/40 focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
          </div>
          {(outN > 0 || rollInputKg > 0 || (p.expectedOutput != null && p.expectedOutput > 0)) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {p.expectedOutput != null && p.expectedOutput > 0 && (
                <span className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold tabular-nums">متوقع {fmt(p.expectedOutput)} كيس</span>
              )}
              {outN > 0 && p.expectedOutput != null && p.expectedOutput > 0 && (() => {
                const dev = ((outN - p.expectedOutput) / p.expectedOutput) * 100
                const abs = Math.abs(dev)
                const cls = abs <= 5 ? 'bg-green-50 text-green-700' : abs <= 15 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                return <span className={`px-2.5 py-1.5 rounded-lg font-semibold tabular-nums ${cls}`}>انحراف {dev > 0 ? '+' : ''}{fmt(dev)}%</span>
              })()}
              {rollInputKg > 0 && (
                <span className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-semibold tabular-nums">رول مسحوب {fmt(rollInputKg)} كجم{p.rollTare ? ` · ~${bagsFromRoll} كيس` : ''}</span>
              )}
              {outN > 0 && (
                <span className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 font-semibold tabular-nums">بن مستهلك {fmt(coffeeConsumed)} كجم</span>
              )}
            </div>
          )}
          <button onClick={complete} disabled={loading || outN <= 0} className="w-full sm:w-auto bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
            {loading ? 'جاري...' : 'إقفال التشغيلة'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {p.expectedOutput != null && p.expectedOutput > 0 && (
            <div className="px-3 py-2 rounded-lg text-[11px] font-bold tabular-nums bg-blue-50 text-blue-700">متوقع: {fmt(p.expectedOutput)} كجم</div>
          )}
          <input
            type="text" inputMode="decimal" dir="ltr" min="1" step="1" max={p.inputWeight}
            value={out} onChange={(e) => setOut(e.target.value)}
            placeholder="وزن الناتج الفعلي (كجم)"
            className="flex-1 min-w-[160px] px-3 py-2.5 border border-amber-300 rounded-xl text-sm tabular-nums bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {outN > 0 && p.expectedOutput != null && p.expectedOutput > 0 && (() => {
            const dev = ((outN - p.expectedOutput) / p.expectedOutput) * 100
            const abs = Math.abs(dev)
            const cls = abs <= 5 ? 'bg-green-50 text-green-700' : abs <= 15 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
            return <div className={`px-3 py-2 rounded-lg text-[11px] font-bold tabular-nums ${cls}`}>انحراف: {dev > 0 ? '+' : ''}{fmt(dev)}%</div>
          })()}
          {outN > 0 && (
            <div className={`px-3 py-2 rounded-lg text-[11px] font-bold tabular-nums ${wastePct > 20 ? 'bg-red-50 text-red-700' : wastePct > 10 ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
              هدر: {fmt(waste)} كجم ({fmt(wastePct)}%)
            </div>
          )}
          <button onClick={complete} disabled={loading || outN <= 0} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 shrink-0 transition-colors">
            {loading ? 'جاري...' : 'إقفال'}
          </button>
        </div>
      )}
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
function PackForm({ blends, finished, packagings, onDone }: {
  blends: BlendT[]; finished: FinishedT[]; packagings: PackagingT[]; onDone: () => void
}) {
  const [sourceId, setSourceId] = useState('')
  const [pullKg, setPullKg] = useState('')
  const [finishedId, setFinishedId] = useState('')
  const [rollId, setRollId] = useState('')
  const [rollPullKg, setRollPullKg] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const sourcesWithStock = blends.filter((b) => b.quantity > 0)
  const source = blends.find((b) => b.id === sourceId)
  const pullN = Number(pullKg) || 0
  const fin = finished.find((f) => f.id === finishedId)

  // لما يختار المنتج النهائي، نختار الرول الافتراضي المربوط بيه (مادة التغليف)
  useEffect(() => {
    if (fin?.packagingId && !rollId) setRollId(fin.packagingId)
  }, [fin?.packagingId]) // eslint-disable-line react-hooks/exhaustive-deps

  const roll = packagings.find((p) => p.id === rollId)

  const pieceWeight = roll?.tare || fin?.tare || 0 // empty_bag_weight — وزن الكيس الفاضي (الفيلم) لكل كيس، جم
  const coreWeight = roll?.estTare || 0            // roll_core_weight — وزن الكرتونة اللي الرول ملفوف عليها، جم لكل رول فعلي
  const rollUnitKg = roll?.rollWeight || 0         // roll_gross_weight — وزن الرول الفعلي الواحد (كجم) من بنك الأصناف

  // أ) البن والأكياس — صافي البن الفعلي في الكيس = الوزن الإجمالي للكيس المعبأ − وزن الكيس الفاضي
  const netCoffeePerBagG = fin ? Math.max(0, fin.gramsPerPiece - pieceWeight) : 0
  const totalBagsFromCoffee = netCoffeePerBagG > 0 && pullN > 0 ? Math.floor((pullN * 1000) / netCoffeePerBagG) : 0
  const coffeeUsedKg = netCoffeePerBagG > 0 ? (totalBagsFromCoffee * netCoffeePerBagG) / 1000 : 0
  const coffeeLeftoverG = netCoffeePerBagG > 0 ? Math.max(0, pullN * 1000 - totalBagsFromCoffee * netCoffeePerBagG) : 0

  // ب) الرول — صافي وزن الرول الواحد بعد خصم الكرتونة، وسعة الرول بالأكياس
  const netRollWeightG = rollUnitKg > 0 ? Math.max(0, rollUnitKg * 1000 - coreWeight) : 0
  const bagsPerRoll = netRollWeightG > 0 && pieceWeight > 0 ? netRollWeightG / pieceWeight : 0
  const totalPackagingWeightG = totalBagsFromCoffee * pieceWeight
  const rollsNeeded = netRollWeightG > 0 && totalPackagingWeightG > 0 ? Math.ceil(totalPackagingWeightG / netRollWeightG) : 0
  const remainingBagsInLastRoll = rollsNeeded > 0 ? Math.max(0, rollsNeeded * bagsPerRoll - totalBagsFromCoffee) : 0
  const suggestedRollPullKg = rollsNeeded * rollUnitKg

  // لو مفيش حجم رول قياسي مسجّل، نرجع للمنطق المبسّط: نحدّ العدد بالأقل بين البن والكمية المسحوبة فعليًا
  const rollN = Number(rollPullKg) || 0
  const bagsFromRollFallback = rollUnitKg <= 0 && rollN > 0 && pieceWeight > 0 ? Math.max(0, Math.floor((rollN * 1000 - coreWeight) / pieceWeight)) : 0
  const expectedBags = rollUnitKg > 0 ? totalBagsFromCoffee : (rollN > 0 ? Math.min(totalBagsFromCoffee, bagsFromRollFallback) : totalBagsFromCoffee)

  // لما يتحدد حجم الرول القياسي وعدد الأكياس، نقترح كمية السحب (عدد الرولات × الحجم الواحد) — المستخدم يقدر يعدّلها
  const lastSuggestion = useRef<string | null>(null)
  useEffect(() => {
    if (rollUnitKg > 0 && suggestedRollPullKg > 0) {
      const suggestion = String(+suggestedRollPullKg.toFixed(3))
      if (rollPullKg === '' || rollPullKg === lastSuggestion.current) {
        setRollPullKg(suggestion)
        lastSuggestion.current = suggestion
      }
    } else if (roll && roll.rollWeight <= 0 && !rollPullKg) {
      // مفيش حجم قياسي — سيب الحقل فاضي عشان المستخدم يكتب الكمية بنفسه
    }
  }, [rollUnitKg, suggestedRollPullKg]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!sourceId || pullN <= 0) { setError('اختار المنتج المطحون واكتب الكمية المسحوبة'); return }
    if (!finishedId) { setError('اختار المنتج النهائي'); return }
    if (source && pullN > source.quantity) { setError(`الكمية المسحوبة أكبر من المتاح (${source.quantity} كجم)`); return }
    if (roll && rollN > 0 && rollN > roll.quantity) { setError(`كمية الرول المسحوبة أكبر من المتاح (${roll.quantity} كجم)`); return }

    setLoading(true)
    const res = await fetch('/api/factory/pack', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceProductId: sourceId, pullKg: pullN, finishedId, rollProductId: rollId || undefined, rollPullKg: rollN || undefined, channel }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setSourceId(''); setPullKg(''); setFinishedId(''); setRollId(''); setRollPullKg(''); onDone()
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

      {/* ٢. الرول (مادة التغليف) — بيتسحب بالوزن كجم */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
        <label className="text-sm font-bold text-amber-700">٢. سحب من الرول (مادة التغليف)</label>
        <SearchableSelect
          value={rollId}
          onChange={setRollId}
          placeholder="اختار الرول / مادة التغليف"
          emptyText="مفيش مواد تغليف مسجّلة"
          className={inputCls}
          options={packagings.map((p) => ({ value: p.id, label: p.name, sublabel: `متاح ${fmt(p.quantity)} كجم · وزن الوحدة ${p.tare} جم` }))}
        />
        <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.001" value={rollPullKg} onChange={(e) => { setRollPullKg(e.target.value); lastSuggestion.current = null }} placeholder="الكمية المسحوبة من الرول (كجم)" className={inputCls} />
        {roll && rollUnitKg > 0 && rollsNeeded > 0 && (
          <p className="text-[11px] text-amber-700">حجم الرول القياسي {fmt(rollUnitKg)} كجم — محتاج {rollsNeeded} رول عشان يغطّي إنتاج البن ({fmt(suggestedRollPullKg)} كجم مقترحة، وتقدر تعدّلها)</p>
        )}
        {roll && rollN > 0 && rollN <= roll.quantity && (
          <p className="text-xs text-green-600">✓ متاح {fmt(roll.quantity)} كجم — هيتبقى {fmt(roll.quantity - rollN)} كجم · وزن الوحدة {roll.tare} جم</p>
        )}
        {roll && rollN > roll.quantity && (
          <p className="text-xs text-red-600">✗ الكمية أكبر من المتاح ({fmt(roll.quantity)} كجم)</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-bold text-gray-700">٣. المنتج النهائي (منتج البيع)</label>
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

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">القناة</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* الشرح التفصيلي / البيان — إنتاج البن + تغليف الرول */}
      {fin && pullN > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl bg-blue-50/40 border border-blue-100 p-4 text-sm space-y-2">
            <p className="font-bold text-blue-700 text-xs mb-1">ملخص الإنتاج (البن)</p>
            <div className="flex justify-between"><span className="text-gray-500">الوزن الإجمالي للكيس المعبأ</span><span className="tabular-nums">{fin.gramsPerPiece} جم</span></div>
            <div className="flex justify-between"><span className="text-gray-500">وزن الكيس الفاضي (الفيلم)</span><span className="tabular-nums">{pieceWeight} جم</span></div>
            <div className="flex justify-between border-t border-blue-100 pt-1.5">
              <span className="text-gray-500">صافي البن في الكيس = {fin.gramsPerPiece} − {pieceWeight} جم</span>
              <span className="tabular-nums font-semibold text-blue-700">{fmt(netCoffeePerBagG)} جم</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">إجمالي عدد الأكياس = {pullN} كجم ÷ {fmt(netCoffeePerBagG)} جم</span>
              <span className="tabular-nums font-bold text-[#0f3460]">~{totalBagsFromCoffee} كيس</span>
            </div>
            <div className="flex justify-between border-t border-blue-100 pt-1.5">
              <span className="text-gray-500">إجمالي البن المستخدم</span>
              <span className="tabular-nums font-semibold text-green-700">{fmt(coffeeUsedKg)} كجم</span>
            </div>
            {coffeeLeftoverG > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">باقي بن (فرق التقريب — يرجع للمخزن)</span>
                <span className="tabular-nums font-semibold text-amber-700">{fmt(coffeeLeftoverG)} جم</span>
              </div>
            )}
          </div>

          {roll && pieceWeight > 0 && (
            <div className="rounded-xl bg-amber-50/40 border border-amber-100 p-4 text-sm space-y-2">
              <p className="font-bold text-amber-700 text-xs mb-1">ملخص التغليف (الرول)</p>
              {rollUnitKg > 0 ? (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">حجم الرول القياسي</span><span className="tabular-nums">{fmt(rollUnitKg)} كجم</span></div>
                  {coreWeight > 0 && <div className="flex justify-between"><span className="text-gray-500">وزن الفارغة (كرتونة الرول — هدر لكل رول)</span><span className="tabular-nums text-red-600">{coreWeight} جم</span></div>}
                  <div className="flex justify-between">
                    <span className="text-gray-500">سعة الرول الفعلية = ({fmt(rollUnitKg)} كجم − {coreWeight} جم) ÷ {pieceWeight} جم</span>
                    <span className="tabular-nums font-semibold text-amber-700">~{fmt(bagsPerRoll)} كيس/رول</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-100 pt-1.5">
                    <span className="text-gray-500">إجمالي وزن أكياس التغليف = {totalBagsFromCoffee} كيس × {pieceWeight} جم</span>
                    <span className="tabular-nums font-semibold">{fmt(totalPackagingWeightG / 1000)} كجم</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">عدد الرولات المطلوبة</span>
                    <span className="tabular-nums font-bold text-[#0f3460]">{rollsNeeded} رول</span>
                  </div>
                  {remainingBagsInLastRoll > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">سعة متبقية في آخر رول (مش هتتستخدم في التشغيلة دي)</span>
                      <span className="tabular-nums font-semibold text-amber-700">~{fmt(remainingBagsInLastRoll)} كيس</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] text-amber-700">مفيش «وزن الرول» قياسي مسجّل في بنك الأصناف لهذا الصنف — العدد المتوقع بيتحدد بالأقل بين البن والكمية اللي هتكتبها.</p>
                  {rollN > 0 && (
                    <div className="flex justify-between border-t border-amber-100 pt-1.5">
                      <span className="text-gray-500">أكياس من الرول = ({rollN} كجم{coreWeight > 0 ? ` − ${coreWeight} جم فارغة` : ''}) ÷ {pieceWeight} جم</span>
                      <span className="tabular-nums font-semibold text-amber-700">~{bagsFromRollFallback} كيس</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex justify-between items-center bg-[#0f3460] text-white rounded-xl px-4 py-3 font-bold">
            <span className="text-sm">عدد الأكياس المتوقع إنتاجها</span>
            <span className="tabular-nums text-lg">~{expectedBags} كيس</span>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">المدخلات (مطحون + رول) بتتخصم بالوزن فور البدء. عند الإقفال المشغّل بيبلّغ عدد الأكياس الفعلية ووزن البن والرول المتبقي (بيرجعوا للمخزن) ووزن الفارغة — والهدر بيتحسب أوتوماتيك.</p>

      <button type="submit" disabled={loading} className="w-full bg-[#0f3460] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#0a2545] disabled:opacity-50 shadow-lg transition">
        {loading ? 'جاري البدء...' : 'بدء التعبئة (فتح تشغيلة)'}
      </button>
    </form>
  )
}
