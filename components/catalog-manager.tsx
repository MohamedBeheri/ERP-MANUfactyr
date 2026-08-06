'use client'

import { useEffect, useMemo, useState } from 'react'
import { Coffee, Leaf, Sparkles, Blend, Package, Boxes, Plus, X, Pencil, Trash2, FlaskConical, Flame } from 'lucide-react'

interface Component { componentId: string; componentName?: string; componentKind?: string; percent: number; perKilo: number; roastDegree?: string | null }
interface Item {
  id: string
  name: string
  itemKind: string
  unit: string
  costPrice: number
  sellPrice: number
  oldPrice: number | null
  wholesalePrice: number
  minKeyPrice: number
  quantity: number
  roastLossPercent: number
  tareWeight: number
  blendId: string | null
  blendName: string | null
  packagingId: string | null
  packagingName: string | null
  gramsPerPiece: number
  piecesPerBox: number
  categoryId: string | null
  stageId: string | null
  imageUrl: string | null
  minStock: number
  isActive: boolean
  showInPos: boolean
  showOnline: boolean
  components: Component[]
}
interface CategoryRef { id: string; name: string }
interface StageRef { id: string; name: string; sellable: boolean; purchasable: boolean }
interface UnitRef { id: string; name: string }

const KINDS = [
  { key: 'GREEN', label: 'البن الأخضر', Icon: Coffee },
  { key: 'ROASTED', label: 'البن المحمص', Icon: Flame },
  { key: 'SPICE', label: 'العطارة', Icon: Leaf },
  { key: 'FLAVOR', label: 'النكهات', Icon: Sparkles },
  { key: 'BLEND', label: 'التوليفات', Icon: Blend },
  { key: 'PACKAGING', label: 'مواد التغليف', Icon: Package },
  { key: 'FINISHED', label: 'المنتجات النهائية', Icon: Boxes },
] as const

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 })

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function CatalogManager() {
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [stages, setStages] = useState<StageRef[]>([])
  const [units, setUnits] = useState<UnitRef[]>([])
  const [tab, setTab] = useState<string>('GREEN')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/catalog')
    if (res.ok) {
      const data = await res.json()
      setItems(data.items || [])
      setCategories(data.categories || [])
      setStages(data.stages || [])
      setUnits(data.units || [])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const byKind = (k: string) => items.filter((i) => i.itemKind === k)
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k.key, byKind(k.key).length])), [items])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 bg-white rounded-xl shadow-sm p-1.5">
        {KINDS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-[#1a1a2e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Icon className="w-4 h-4" /> {label}
            <span className="opacity-60 tabular-nums text-xs">({counts[key] || 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400 text-sm">جاري التحميل…</div>
      ) : (
        <KindTab key={tab} kind={tab} items={items} categories={categories} stages={stages} units={units} reload={load} />
      )}
    </div>
  )
}

function KindTab({ kind, items, categories, stages, units, reload }: { kind: string; items: Item[]; categories: CategoryRef[]; stages: StageRef[]; units: UnitRef[]; reload: () => void }) {
  const list = items.filter((i) => i.itemKind === kind)
  const empty: any = {
    name: '', unit: units[0]?.name || '', costPrice: '', sellPrice: '', oldPrice: '', wholesalePrice: '', minKeyPrice: '',
    roastLossPercent: '', tareWeight: '', blendId: '', packagingId: '', gramsPerPiece: '', piecesPerBox: '1',
    categoryId: '', stageId: '', minStock: '0', imageUrl: '',
    showInPos: false, showOnline: true,
  }
  const [form, setForm] = useState<any>(empty)
  const [components, setComponents] = useState<Component[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const blends = items.filter((i) => i.itemKind === 'BLEND')
  const packagings = items.filter((i) => i.itemKind === 'PACKAGING')
  const blendable = items.filter((i) => ['GREEN', 'ROASTED', 'SPICE', 'FLAVOR'].includes(i.itemKind))

  const reset = () => { setForm(empty); setComponents([]); setEditId(null); setError('') }

  const startEdit = (it: Item) => {
    setEditId(it.id)
    setForm({
      name: it.name, unit: it.unit, costPrice: String(it.costPrice || ''), sellPrice: String(it.sellPrice || ''),
      oldPrice: it.oldPrice ? String(it.oldPrice) : '', wholesalePrice: String(it.wholesalePrice || ''),
      minKeyPrice: String(it.minKeyPrice || ''), roastLossPercent: String(it.roastLossPercent || ''),
      tareWeight: String(it.tareWeight || ''), blendId: it.blendId || '', packagingId: it.packagingId || '',
      gramsPerPiece: String(it.gramsPerPiece || ''), piecesPerBox: String(it.piecesPerBox || 1),
      categoryId: it.categoryId || '', stageId: it.stageId || '', minStock: String(it.minStock || 0),
      imageUrl: it.imageUrl || '',
      showInPos: it.showInPos, showOnline: it.showOnline,
    })
    setComponents(it.components.map((c) => ({ ...c })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleImage = async (file?: File) => {
    if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      setForm((f: any) => ({ ...f, imageUrl: dataUrl }))
    } catch {
      setError('فشل تحميل الصورة — جرّب صورة تانية')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!form.name.trim()) { setError('اكتب اسم الصنف'); return }
    const body: any = { ...form, itemKind: kind }
    if (kind === 'BLEND') body.components = components.filter((c) => c.componentId)
    const res = await fetch(editId ? `/api/catalog/${editId}` : '/api/catalog', {
      method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    reset(); reload()
  }

  const remove = async (it: Item) => {
    if (!confirm(`حذف "${it.name}"؟`)) return
    const res = await fetch(`/api/catalog/${it.id}`, { method: 'DELETE' })
    if (res.ok) reload()
  }

  const kindLabel = KINDS.find((k) => k.key === kind)!.label
  const pctTotal = components.filter((c) => c.componentId).reduce((s, c) => s + (Number(c.percent) || 0), 0)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      {/* الفورم */}
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل' : 'إضافة'} — {kindLabel}</h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الصنف" className={inputCls} />

        {/* المرحلة المخزنية + تصنيف البيع */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">المرحلة المخزنية</label>
            <select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className={inputCls}>
              <option value="">تلقائي</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.sellable ? ' (بيع)' : s.purchasable ? ' (شراء)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">تصنيف البيع</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputCls}>
              <option value="">بدون تصنيف</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {kind === 'GREEN' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">نسبة خسران التحميص %</label>
            <input type="text" inputMode="decimal" dir="ltr" min="0" max="100" step="0.1" value={form.roastLossPercent} onChange={(e) => setForm({ ...form, roastLossPercent: e.target.value })} className={inputCls} placeholder="16" />
          </div>
        )}

        {kind === 'PACKAGING' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">وزن الفارغ للقطعة (جرام)</label>
            <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" value={form.tareWeight} onChange={(e) => setForm({ ...form, tareWeight: e.target.value })} className={inputCls} placeholder="1.6" />
          </div>
        )}

        {kind === 'BLEND' && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"><FlaskConical className="w-3.5 h-3.5" /> الوصفة (كل مكوّن بنسبة مئوية — المجموع = 100%)</label>
            <p className="text-[10px] text-gray-400">مثال: توليفة قهوة بندق = 20% بن أخضر إندونيسي (فاتح) + 80% نكهة البندق. الأوزان بتتحسب وقت التصنيع من الكمية المخططة.</p>
            {components.map((c, i) => {
              const comp = blendable.find((b) => b.id === c.componentId)
              const isGreen = comp?.itemKind === 'GREEN'
              return (
                <div key={i} className="flex gap-2 items-center">
                  <select value={c.componentId} onChange={(e) => setComponents(components.map((x, j) => j === i ? { ...x, componentId: e.target.value } : x))} className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">اختار المكوّن</option>
                    <optgroup label="بن محمص جاهز (من تشغيلات التحميص)">{blendable.filter((b) => b.itemKind === 'ROASTED').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
                    <optgroup label="بن محمص (اختار الأصل ودرجة التحميص)">{blendable.filter((b) => b.itemKind === 'GREEN').map((b) => <option key={b.id} value={b.id}>{b.name} — يتحمّص عند التصنيع</option>)}</optgroup>
                    <optgroup label="نكهات">{blendable.filter((b) => b.itemKind === 'FLAVOR').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
                    <optgroup label="عطارة">{blendable.filter((b) => b.itemKind === 'SPICE').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
                  </select>
                  {isGreen && (
                    <select value={c.roastDegree || ''} onChange={(e) => setComponents(components.map((x, j) => j === i ? { ...x, roastDegree: e.target.value } : x))} className="w-20 shrink-0 px-1 py-2 border border-gray-300 rounded-lg text-xs">
                      <option value="">درجة</option>
                      <option value="فاتح">فاتح</option>
                      <option value="وسط">وسط</option>
                      <option value="غامق">غامق</option>
                      <option value="محروق">محروق</option>
                    </select>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <input type="text" inputMode="decimal" dir="ltr" min="0" max="100" step="0.5" placeholder="0" value={c.percent || ''} onChange={(e) => setComponents(components.map((x, j) => j === i ? { ...x, percent: Number(e.target.value) } : x))} className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums text-center" />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  <button type="button" onClick={() => setComponents(components.filter((_, j) => j !== i))} className="shrink-0 text-red-500"><X className="w-4 h-4" /></button>
                </div>
              )
            })}
            <button type="button" onClick={() => setComponents([...components, { componentId: '', percent: 0, perKilo: 0 }])} className="text-xs text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة مكوّن</button>
            {components.length > 0 && (
              <p className={`text-xs font-bold ${Math.abs(pctTotal - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>مجموع نسب الوصفة: {fmt(pctTotal)}% {Math.abs(pctTotal - 100) < 0.01 ? '✓' : `(المطلوب 100% — ناقص/زيادة ${fmt(Math.abs(100 - pctTotal))}%)`}</p>
            )}
          </div>
        )}

        {kind === 'FINISHED' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">التوليفة المستخدمة</label>
              <select value={form.blendId} onChange={(e) => setForm({ ...form, blendId: e.target.value })} className={inputCls}>
                <option value="">اختار التوليفة</option>
                {blends.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">وزن القطعة (جرام)</label>
                <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.1" value={form.gramsPerPiece} onChange={(e) => setForm({ ...form, gramsPerPiece: e.target.value })} className={inputCls} placeholder="250" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">قطع/علبة</label>
                <input type="text" inputMode="decimal" dir="ltr" min="1" value={form.piecesPerBox} onChange={(e) => setForm({ ...form, piecesPerBox: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">مادة التغليف</label>
              <select value={form.packagingId} onChange={(e) => setForm({ ...form, packagingId: e.target.value })} className={inputCls}>
                <option value="">اختار التغليف</option>
                {packagings.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </>
        )}

        {/* الأسعار حسب النوع:
            - خامات (أخضر/عطارة/نكهات): سعر شراء فقط — بتتشرى ومبتتبعش
            - توليفات: بدون أسعار — التكلفة محسوبة من المكونات
            - تغليف/محمص/منتجات نهائية: كل الأسعار (بيع وشراء) */}
        {['GREEN', 'SPICE', 'FLAVOR'].includes(kind) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">سعر الشراء</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">وحدة القياس</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
                {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
          </div>
        )}
        {kind === 'BLEND' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">وحدة القياس</label>
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
              {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          </div>
        )}
        {['ROASTED', 'PACKAGING', 'FINISHED'].includes(kind) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">سعر التكلفة</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">سعر القطاعي</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">السعر قبل الخصم <span className="text-gray-400 font-normal">(شارة تخفيض)</span></label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" value={form.oldPrice} onChange={(e) => setForm({ ...form, oldPrice: e.target.value })} className={inputCls} placeholder="اختياري" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">سعر الجملة</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">أقل سعر لكبار الموردين</label>
              <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" value={form.minKeyPrice} onChange={(e) => setForm({ ...form, minKeyPrice: e.target.value })} className={inputCls} placeholder="الحد الأدنى في بيان السعر" />
            </div>
            {kind !== 'FINISHED' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">وحدة القياس</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
                  {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* أماكن ظهور الصنف للبيع */}
        {['ROASTED', 'PACKAGING', 'FINISHED'].includes(kind) && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">أماكن الظهور للبيع</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={!!form.showInPos} onChange={(e) => setForm({ ...form, showInPos: e.target.checked })} className="w-4 h-4 accent-[#e94560]" />
                نقطة البيع (الكافيه)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={!!form.showOnline} onChange={(e) => setForm({ ...form, showOnline: e.target.checked })} className="w-4 h-4 accent-[#0f3460]" />
                الموقع الأونلاين
              </label>
            </div>
          </div>
        )}

        {/* الحد الأدنى للمخزون */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">الحد الأدنى للمخزون</label>
          <input type="text" inputMode="decimal" dir="ltr" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className={inputCls} />
        </div>

        {/* صورة المنتج */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">صورة المنتج</label>
          <div className="flex items-center gap-3">
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="معاينة" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-gray-50" />
            ) : (
              <div className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-xs">بدون</div>
            )}
            <div className="flex-1 space-y-1.5">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImage(e.target.files?.[0])}
                className="block w-full text-xs text-gray-500 file:ml-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#0f3460] file:text-white file:text-xs file:font-semibold file:cursor-pointer"
              />
              {form.imageUrl && (
                <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })} className="text-xs text-red-500 hover:underline">حذف الصورة</button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">{editId ? 'حفظ' : 'إضافة'}</button>
          {editId && <button type="button" onClick={reset} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>}
        </div>
      </form>

      {/* القائمة */}
      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-3">{kindLabel} ({list.length})</h3>
        {list.length === 0 && <p className="text-sm text-gray-500">مفيش أصناف في القسم ده لسه.</p>}
        <div className="space-y-2">
          {list.map((it) => (
            <div key={it.id} className="flex items-start justify-between border border-gray-100 rounded-lg p-3">
              <div className="min-w-0 flex gap-3">
                {it.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.imageUrl} alt="" className="w-10 h-10 object-contain rounded bg-gray-50 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{it.name}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1 text-[10px]">
                    {kind === 'GREEN' && it.roastLossPercent > 0 && <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">خسران {fmt(it.roastLossPercent)}%</span>}
                    {kind === 'PACKAGING' && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">فارغ {fmt(it.tareWeight)}جم</span>}
                    {kind === 'FINISHED' && it.blendName && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">{it.blendName}</span>}
                    {kind === 'FINISHED' && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold tabular-nums">{fmt(it.gramsPerPiece)}جم × {it.piecesPerBox}</span>}
                    {kind === 'FINISHED' && it.packagingName && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold">{it.packagingName}</span>}
                    {it.quantity !== 0 && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">رصيد {fmt(it.quantity)} {it.unit}</span>}
                    {['GREEN', 'SPICE', 'FLAVOR'].includes(kind) && it.costPrice > 0 && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">شراء {fmt(it.costPrice)}</span>}
                    {['ROASTED', 'PACKAGING', 'FINISHED'].includes(kind) && it.sellPrice > 0 && <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">قطاعي {fmt(it.sellPrice)}</span>}
                    {['ROASTED', 'PACKAGING', 'FINISHED'].includes(kind) && it.wholesalePrice > 0 && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">جملة {fmt(it.wholesalePrice)}</span>}
                    {it.minStock > 0 && <span className="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">حد أدنى {it.minStock}</span>}
                    {['ROASTED', 'PACKAGING', 'FINISHED'].includes(kind) && (
                      it.showInPos
                        ? <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-semibold">نقطة البيع ✓</span>
                        : <span className="bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-semibold">مخفي من نقطة البيع</span>
                    )}
                    {['ROASTED', 'PACKAGING', 'FINISHED'].includes(kind) && (
                      it.showOnline
                        ? <span className="bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-semibold">أونلاين ✓</span>
                        : <span className="bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-semibold">مخفي من الأونلاين</span>
                    )}
                  </div>
                  {kind === 'BLEND' && it.components.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      {it.components.map((c) => {
                        const suffix = c.componentKind === 'GREEN' ? ` — محمص ${c.roastDegree || 'وسط'}` : ''
                        return `${c.percent}% ${c.componentName}${suffix}`
                      }).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(it)} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(it)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
