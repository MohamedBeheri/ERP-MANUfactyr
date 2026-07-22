'use client'

import { useEffect, useMemo, useState } from 'react'
import { Coffee, Leaf, Sparkles, Blend, Package, Boxes, Plus, X, Pencil, Trash2, FlaskConical } from 'lucide-react'

interface Component { componentId: string; componentName?: string; componentKind?: string; percent: number; perKilo: number }
interface Item {
  id: string
  name: string
  itemKind: string
  unit: string
  costPrice: number
  sellPrice: number
  wholesalePrice?: number
  quantity: number
  roastLossPercent: number
  tareWeight: number
  blendId: string | null
  blendName: string | null
  packagingId: string | null
  packagingName: string | null
  gramsPerPiece: number
  piecesPerBox: number
  components: Component[]
}

const KINDS = [
  { key: 'GREEN', label: 'البن الأخضر', Icon: Coffee },
  { key: 'SPICE', label: 'العطارة', Icon: Leaf },
  { key: 'FLAVOR', label: 'النكهات', Icon: Sparkles },
  { key: 'BLEND', label: 'التوليفات', Icon: Blend },
  { key: 'PACKAGING', label: 'مواد التغليف', Icon: Package },
  { key: 'FINISHED', label: 'المنتجات النهائية', Icon: Boxes },
] as const

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 })

export function CatalogManager() {
  const [items, setItems] = useState<Item[]>([])
  const [tab, setTab] = useState<string>('GREEN')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/catalog')
    setItems(res.ok ? await res.json() : [])
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
        <KindTab key={tab} kind={tab} items={items} reload={load} />
      )}
    </div>
  )
}

function KindTab({ kind, items, reload }: { kind: string; items: Item[]; reload: () => void }) {
  const list = items.filter((i) => i.itemKind === kind)
  const empty = { name: '', unit: '', costPrice: '', sellPrice: '', wholesalePrice: '', roastLossPercent: '', tareWeight: '', blendId: '', packagingId: '', gramsPerPiece: '', piecesPerBox: '1' }
  const [form, setForm] = useState<any>(empty)
  const [components, setComponents] = useState<Component[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const blends = items.filter((i) => i.itemKind === 'BLEND')
  const packagings = items.filter((i) => i.itemKind === 'PACKAGING')
  const blendable = items.filter((i) => ['GREEN', 'SPICE', 'FLAVOR'].includes(i.itemKind))

  const reset = () => { setForm(empty); setComponents([]); setEditId(null); setError('') }

  const startEdit = (it: Item) => {
    setEditId(it.id)
    setForm({
      name: it.name, unit: it.unit, costPrice: String(it.costPrice || ''), sellPrice: String(it.sellPrice || ''),
      wholesalePrice: String(it.wholesalePrice || ''), roastLossPercent: String(it.roastLossPercent || ''),
      tareWeight: String(it.tareWeight || ''), blendId: it.blendId || '', packagingId: it.packagingId || '',
      gramsPerPiece: String(it.gramsPerPiece || ''), piecesPerBox: String(it.piecesPerBox || 1),
    })
    setComponents(it.components.map((c) => ({ ...c })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
  const pctTotal = components.filter((c) => blendable.find((b) => b.id === c.componentId)?.itemKind === 'GREEN').reduce((s, c) => s + (Number(c.percent) || 0), 0)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      {/* الفورم */}
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل' : 'إضافة'} — {kindLabel}</h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الصنف" className={inputCls} />

        {kind === 'GREEN' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">نسبة خسران التحميص %</label>
            <input type="number" min="0" max="100" step="0.1" value={form.roastLossPercent} onChange={(e) => setForm({ ...form, roastLossPercent: e.target.value })} className={inputCls} placeholder="16" />
          </div>
        )}

        {kind === 'PACKAGING' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">وزن الفارغ للقطعة (جرام)</label>
            <input type="number" min="0" step="0.01" value={form.tareWeight} onChange={(e) => setForm({ ...form, tareWeight: e.target.value })} className={inputCls} placeholder="1.6" />
          </div>
        )}

        {kind === 'BLEND' && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"><FlaskConical className="w-3.5 h-3.5" /> الوصفة (بن أخضر بنسبة % / عطارة بجرعة لكل كيلو)</label>
            {components.map((c, i) => {
              const comp = blendable.find((b) => b.id === c.componentId)
              const isGreen = comp?.itemKind === 'GREEN'
              return (
                <div key={i} className="flex gap-2">
                  <select value={c.componentId} onChange={(e) => setComponents(components.map((x, j) => j === i ? { ...x, componentId: e.target.value } : x))} className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">اختار المكوّن</option>
                    <optgroup label="بن أخضر">{blendable.filter((b) => b.itemKind === 'GREEN').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
                    <optgroup label="عطارة">{blendable.filter((b) => b.itemKind === 'SPICE').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
                    <optgroup label="نكهات">{blendable.filter((b) => b.itemKind === 'FLAVOR').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
                  </select>
                  {isGreen ? (
                    <input type="number" min="0" step="0.01" placeholder="%" value={c.percent || ''} onChange={(e) => setComponents(components.map((x, j) => j === i ? { ...x, percent: Number(e.target.value) } : x))} className="w-16 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
                  ) : (
                    <input type="number" min="0" step="0.1" placeholder="جم/كيلو" value={c.perKilo || ''} onChange={(e) => setComponents(components.map((x, j) => j === i ? { ...x, perKilo: Number(e.target.value) } : x))} className="w-20 shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm tabular-nums" />
                  )}
                  <button type="button" onClick={() => setComponents(components.filter((_, j) => j !== i))} className="shrink-0 text-red-500"><X className="w-4 h-4" /></button>
                </div>
              )
            })}
            <button type="button" onClick={() => setComponents([...components, { componentId: '', percent: 0, perKilo: 0 }])} className="text-xs text-[#0f3460] font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> إضافة مكوّن</button>
            {components.length > 0 && (
              <p className={`text-[11px] ${Math.abs(pctTotal - 100) < 0.5 ? 'text-green-600' : 'text-amber-600'}`}>مجموع نِسب البن الأخضر: {fmt(pctTotal)}%{Math.abs(pctTotal - 100) >= 0.5 ? ' (المفروض 100%)' : ' ✓'}</p>
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
                <input type="number" min="0" step="0.1" value={form.gramsPerPiece} onChange={(e) => setForm({ ...form, gramsPerPiece: e.target.value })} className={inputCls} placeholder="250" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">قطع/علبة</label>
                <input type="number" min="1" value={form.piecesPerBox} onChange={(e) => setForm({ ...form, piecesPerBox: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">مادة التغليف</label>
              <select value={form.packagingId} onChange={(e) => setForm({ ...form, packagingId: e.target.value })} className={inputCls}>
                <option value="">اختار التغليف</option>
                {packagings.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">سعر البيع</label>
                <input type="number" min="0" step="0.01" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">سعر الجملة</label>
                <input type="number" min="0" step="0.01" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} className={inputCls} />
              </div>
            </div>
          </>
        )}

        {kind !== 'FINISHED' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">وحدة القياس</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={kind === 'PACKAGING' ? 'قطعة' : 'كجم'} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">سعر التكلفة</label>
              <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className={inputCls} />
            </div>
          </div>
        )}

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
              <div className="min-w-0">
                <p className="font-semibold text-sm">{it.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1 text-[10px]">
                  {kind === 'GREEN' && it.roastLossPercent > 0 && <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">خسران {fmt(it.roastLossPercent)}%</span>}
                  {kind === 'PACKAGING' && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">فارغ {fmt(it.tareWeight)}جم</span>}
                  {kind === 'FINISHED' && it.blendName && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">{it.blendName}</span>}
                  {kind === 'FINISHED' && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold tabular-nums">{fmt(it.gramsPerPiece)}جم × {it.piecesPerBox}</span>}
                  {kind === 'FINISHED' && it.packagingName && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold">{it.packagingName}</span>}
                  {it.quantity !== 0 && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">رصيد {fmt(it.quantity)} {it.unit}</span>}
                </div>
                {kind === 'BLEND' && it.components.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    {it.components.map((c) => `${c.componentName} ${c.percent > 0 ? c.percent + '%' : c.perKilo + 'جم/كيلو'}`).join(' · ')}
                  </p>
                )}
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
