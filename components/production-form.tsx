'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Factory, Plus, X, TriangleAlert, BookMarked } from 'lucide-react'

interface ProductLite {
  id: string
  name: string
  quantity: number
  unit: string
  stageId: string | null
}
interface WarehouseOption {
  id: string
  name: string
  isDefault: boolean
}
interface OperationLite {
  id: string
  name: string
  inputStageId: string | null
  outputStageId: string | null
  inputStageName: string | null
  outputStageName: string | null
  hasYieldLoss: boolean
}
interface RecipeLite {
  id: string
  name: string
  lineType: string
  roastLevel: string | null
  grindType: string | null
  expectedWaste: number
  items: { productId: string; percentage: number; productName: string }[]
}

interface Props {
  products: ProductLite[]
  operations: OperationLite[]
  warehouses?: WarehouseOption[]
  recipes?: RecipeLite[]
}

export const ROAST_LEVELS = ['تحميص فاتح', 'تحميص وسط', 'تحميص غامق (إسبريسو)']
export const GRIND_TYPES = [
  'ناعم جداً (تركي)',
  'ناعم (إسبريسو)',
  'متوسط (فلتر/تقطير)',
  'خشن (فرنش برس/كولد برو)',
]

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

const num = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function ProductionForm({ products, operations, warehouses = [], recipes = [] }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [operationId, setOperationId] = useState(operations[0]?.id || '')
  const [batchNo, setBatchNo] = useState('')
  const [roastLevel, setRoastLevel] = useState(ROAST_LEVELS[1])
  const [grindType, setGrindType] = useState(GRIND_TYPES[1])
  const [expiryDate, setExpiryDate] = useState('')
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '')
  const [recipeId, setRecipeId] = useState('')
  const [opCost, setOpCost] = useState('')
  const [notes, setNotes] = useState('')
  const [inputs, setInputs] = useState([{ productId: '', quantity: '' }])
  const [items, setItems] = useState([{ productId: '', quantity: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const operation = operations.find((o) => o.id === operationId)
  const inputProducts = useMemo(
    () => products.filter((p) => !operation?.inputStageId || p.stageId === operation.inputStageId),
    [products, operation]
  )
  const outputProducts = useMemo(
    () => products.filter((p) => !operation?.outputStageId || p.stageId === operation.outputStageId),
    [products, operation]
  )
  const stockMap = useMemo(() => {
    const m = new Map<string, ProductLite>()
    products.forEach((p) => m.set(p.id, p))
    return m
  }, [products])

  const lineRecipes = recipes.filter((r) => (operation?.hasYieldLoss ? r.lineType === 'ROASTING' : r.lineType === 'PROCESSING'))

  // حسابات الوزن والهدر
  const inputWeight = inputs.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const outputWeight = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const wasteWeight = Math.max(0, inputWeight - outputWeight)
  const wastePercent = inputWeight > 0 ? (wasteWeight / inputWeight) * 100 : 0
  const roastWasteWarn = operation?.hasYieldLoss && outputWeight > 0 && (wastePercent < 10 || wastePercent > 22)

  const applyRecipe = (id: string) => {
    setRecipeId(id)
    const r = lineRecipes.find((x) => x.id === id)
    if (!r) return
    if (r.roastLevel) setRoastLevel(r.roastLevel)
    if (r.grindType) setGrindType(r.grindType)
    setInputs(r.items.map((it) => ({ productId: it.productId, quantity: '' })))
  }

  const distributeByRecipe = (totalWeight: string) => {
    const r = lineRecipes.find((x) => x.id === recipeId)
    if (!r) return
    const total = Number(totalWeight) || 0
    setInputs(r.items.map((it) => ({ productId: it.productId, quantity: String(Math.round((total * it.percentage) / 100)) })))
  }

  const changeOperation = (id: string) => {
    setOperationId(id)
    setRecipeId('')
    setInputs([{ productId: '', quantity: '' }])
    setItems([{ productId: '', quantity: '' }])
  }

  const reset = () => {
    setBatchNo(''); setExpiryDate(''); setRecipeId('')
    setOpCost(''); setNotes(''); setInputs([{ productId: '', quantity: '' }]); setItems([{ productId: '', quantity: '' }])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!operation) { setError('اختار عملية التصنيع'); return }
    const cleanInputs = inputs.filter((i) => i.productId && Number(i.quantity) > 0)
    const cleanItems = items.filter((i) => i.productId && Number(i.quantity) > 0)
    if (cleanInputs.length === 0 || cleanItems.length === 0) {
      setError('أدخل خامة واحدة على الأقل في المدخلات ومنتج ناتج واحد على الأقل')
      return
    }
    setLoading(true)
    const res = await fetch('/api/production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: operation.id,
        stage: operation.name,
        batchNo,
        roastLevel: operation.hasYieldLoss ? roastLevel : undefined,
        grindType: !operation.hasYieldLoss ? grindType : undefined,
        expiryDate: expiryDate || undefined,
        recipeId: recipeId || undefined,
        warehouseId,
        opCost: Number(opCost) || 0,
        notes,
        inputs: cleanInputs.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        items: cleanItems.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    reset()
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-[#0f3460] text-white py-3 rounded-xl font-semibold hover:bg-[#0a2545] transition-colors"
      >
        <Factory className="w-5 h-5" />
        أمر تصنيع جديد
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
          <Factory className="w-5 h-5 text-[#0f3460]" />
          أمر تصنيع جديد
        </h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
          <X className="w-5 h-5" />
        </button>
      </div>

      {operations.length === 0 ? (
        <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm">
          مفيش عمليات تصنيع معرّفة. روح للإعدادات ← عمليات التصنيع وعرّف عملياتك (تحميص، طحن، تعبئة).
        </div>
      ) : (
        <>
          {/* اختيار العملية */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">عملية التصنيع</label>
            <select value={operationId} onChange={(e) => changeOperation(e.target.value)} className={inputCls}>
              {operations.map((op) => (
                <option key={op.id} value={op.id}>{op.name}</option>
              ))}
            </select>
            {operation && (
              <p className="text-xs text-gray-500 mt-1">
                تسحب من <span className="font-semibold text-gray-700">{operation.inputStageName || '؟'}</span>
                {' '}← تنتج في <span className="font-semibold text-green-700">{operation.outputStageName || '؟'}</span>
                {operation.hasYieldLoss && ' · فيها هدر'}
              </p>
            )}
          </div>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          {/* الوصفة */}
          {lineRecipes.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1">
                <BookMarked className="w-4 h-4 text-[#0f3460]" /> تحميل وصفة جاهزة (BOM)
              </label>
              <select value={recipeId} onChange={(e) => applyRecipe(e.target.value)} className={inputCls}>
                <option value="">بدون وصفة — إدخال يدوي</option>
                {lineRecipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {recipeId && (
                <div className="mt-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">الوزن الإجمالي للخلطة — هيتوزّع على النسب</label>
                  <input type="number" min="0" onChange={(e) => distributeByRecipe(e.target.value)} className={inputCls} placeholder="مثال: 10000" />
                </div>
              )}
            </div>
          )}

          {/* المدخلات */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              المدخلات {operation?.inputStageName ? `(${operation.inputStageName})` : ''}
            </label>
            {inputProducts.length === 0 && (
              <p className="text-xs text-amber-600">مفيش أصناف في مرحلة السحب دي — ضيف أصناف على المرحلة من الإعدادات.</p>
            )}
            {inputs.map((inp, i) => {
              const pct = inputWeight > 0 ? ((Number(inp.quantity) || 0) / inputWeight) * 100 : 0
              return (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={inp.productId}
                    onChange={(e) => setInputs(inputs.map((it, j) => (j === i ? { ...it, productId: e.target.value } : it)))}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
                  >
                    <option value="">اختار الخامة</option>
                    {inputProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (متاح: {num(p.quantity)} {p.unit})</option>
                    ))}
                  </select>
                  <input
                    type="number" min="0" placeholder="وزن"
                    value={inp.quantity}
                    onChange={(e) => setInputs(inputs.map((it, j) => (j === i ? { ...it, quantity: e.target.value } : it)))}
                    className="w-20 shrink-0 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm tabular-nums"
                  />
                  {inputWeight > 0 && inp.quantity && (
                    <span className="text-[10px] text-gray-400 w-9 shrink-0 tabular-nums">{pct.toFixed(0)}%</span>
                  )}
                  {inputs.length > 1 && (
                    <button type="button" onClick={() => setInputs(inputs.filter((_, j) => j !== i))} className="shrink-0 text-red-500" aria-label="حذف">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
            <button type="button" onClick={() => setInputs([...inputs, { productId: '', quantity: '' }])} className="flex items-center gap-1 text-sm text-[#0f3460] font-medium">
              <Plus className="w-4 h-4" /> إضافة خامة للخلطة
            </button>
          </div>

          {/* درجة التحميص / الطحن حسب العملية */}
          {operation?.hasYieldLoss ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">درجة التحميص</label>
              <select value={roastLevel} onChange={(e) => setRoastLevel(e.target.value)} className={inputCls}>
                {ROAST_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">درجة الطحن</label>
              <select value={grindType} onChange={(e) => setGrindType(e.target.value)} className={inputCls}>
                {GRIND_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}

          {/* المخرجات */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              المخرجات {operation?.outputStageName ? `(${operation.outputStageName})` : ''}
            </label>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={item.productId}
                  onChange={(e) => setItems(items.map((it, j) => (j === i ? { ...it, productId: e.target.value } : it)))}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
                >
                  <option value="">اختار المنتج الناتج</option>
                  {outputProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                  type="number" min="0" placeholder="وزن/عدد"
                  value={item.quantity}
                  onChange={(e) => setItems(items.map((it, j) => (j === i ? { ...it, quantity: e.target.value } : it)))}
                  className="w-24 shrink-0 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm tabular-nums"
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="shrink-0 text-red-500" aria-label="حذف">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, { productId: '', quantity: '' }])} className="flex items-center gap-1 text-sm text-[#0f3460] font-medium">
              <Plus className="w-4 h-4" /> إضافة منتج ناتج
            </button>
          </div>

          {/* ملخص الوزن والهدر */}
          {inputWeight > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-[#1a1a2e] tabular-nums">{num(inputWeight)}</p>
                <p className="text-[11px] text-gray-500">المدخل</p>
              </div>
              <div>
                <p className="text-sm font-bold text-green-700 tabular-nums">{num(outputWeight)}</p>
                <p className="text-[11px] text-gray-500">الناتج</p>
              </div>
              <div>
                <p className={`text-sm font-bold tabular-nums ${roastWasteWarn ? 'text-red-600' : 'text-orange-600'}`}>
                  {num(wasteWeight)} ({wastePercent.toFixed(1)}%)
                </p>
                <p className="text-[11px] text-gray-500">الهدر</p>
              </div>
            </div>
          )}
          {roastWasteWarn && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 p-2.5 rounded-lg text-xs">
              <TriangleAlert className="w-4 h-4 shrink-0" />
              نسبة الهدر في التحميص غالبًا بين 15% و20% — راجع الأوزان.
            </div>
          )}

          {/* التشغيلة والصلاحية والمخزن */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">رقم التشغيلة (Lot)</label>
              <input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="اختياري" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ الصلاحية</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">تكلفة التشغيل (ج.م)</label>
              <input type="number" min="0" step="0.01" value={opCost} onChange={(e) => setOpCost(e.target.value)} className={inputCls} />
            </div>
            {warehouses.length > 1 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">المخزن</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <input placeholder="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50">
              {loading ? 'جاري التنفيذ...' : 'تنفيذ أمر التصنيع'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">إلغاء</button>
          </div>
        </>
      )}
    </form>
  )
}
