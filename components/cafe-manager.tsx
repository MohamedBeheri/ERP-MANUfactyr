'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react'
import { CafePos } from '@/components/cafe-pos'

interface Material {
  id: string; name: string; unit: string; costPrice: number; stock: number
  minStock?: number
  category?: string | null
  stocks?: { warehouseId: string; quantity: number }[]
}
interface RecipeLine { materialId: string; materialName: string; unit: string; quantity: number }
interface CafeItem {
  id: string; name: string; unit: string; sellPrice: number; categoryId: string | null
  showInPos: boolean
  stock: number // رصيد البيع المباشر في مخزن الكافيه (للأصناف بدون توليفة)
  recipe: RecipeLine[]
}
interface CafePurchase {
  id: string; invoiceNo: string; supplier: string; total: number; createdAt: string
  items: { name: string; quantity: number; unit: string }[]
}
interface Movement { id: string; productName: string; unit: string; quantity: number; source: string; createdAt: string }
interface PosData {
  products: {
    id: string; name: string; unit: string; sellPrice: number; wholesalePrice: number
    quantity: number; categoryId: string | null; imageUrl: string | null; hasRecipe?: boolean
  }[]
  customers: { id: string; name: string; customerType: 'RETAIL' | 'WHOLESALE'; tier: { name: string; priceSource: string; discountPercent: number } | null }[]
  categories: { id: string; name: string }[]
  warehouses: { id: string; name: string; isDefault: boolean }[]
  cafeWarehouseId?: string
  canSell: boolean
}
interface Props {
  warehouses: { id: string; name: string; isDefault: boolean }[]
  materials: Material[]
  cafeItems: CafeItem[]
  categories: { id: string; name: string }[]
  purchases: CafePurchase[]
  movements: Movement[]
  pos: PosData
  units: { id: string; name: string }[]
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const TABS = ['pos', 'warehouse', 'items', 'purchases'] as const

export function CafeManager({ warehouses, materials, cafeItems, categories, purchases, movements, pos, units, canAdd, canEdit, canDelete }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<(typeof TABS)[number]>('pos')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'pos', label: 'نقطة البيع' },
          { key: 'warehouse', label: `مخزن الكافيه (${materials.length})` },
          { key: 'items', label: `المنتجات (${cafeItems.length})` },
          { key: 'purchases', label: `مشتريات الكافيه (${purchases.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-[#e94560] text-[#e94560]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pos' && (
        <CafePos
          products={pos.products}
          customers={pos.customers}
          categories={pos.categories}
          warehouses={pos.warehouses}
          cafeWarehouseId={pos.cafeWarehouseId}
          canAdd={pos.canSell}
        />
      )}
      {tab === 'warehouse' && (
        <div className="space-y-4">
          <DirectItemsPanel items={cafeItems} canEdit={canEdit} router={router} />
          <MaterialsTab materials={materials} categories={categories} units={units} canAdd={canAdd} canDelete={canDelete} router={router} />
          <MovementsPanel movements={movements} />
        </div>
      )}
      {tab === 'items' && (
        <ItemsTab cafeItems={cafeItems} materials={materials} categories={categories} units={units} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} router={router} />
      )}
      {tab === 'purchases' && <PurchasesTab purchases={purchases} canAdd={canAdd} />}
    </div>
  )
}

// سويتش ظهور الصنف في نقطة البيع
function PosToggle({ id, value, canEdit, router }: { id: string; value: boolean; canEdit: boolean; router: any }) {
  const [busy, setBusy] = useState(false)
  async function toggle() {
    if (!canEdit || busy) return
    setBusy(true)
    await fetch(`/api/cafe/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showInPos: !value }),
    })
    setBusy(false)
    router.refresh()
  }
  return (
    <button
      onClick={toggle}
      disabled={!canEdit || busy}
      title={value ? 'ظاهر في نقطة البيع — اضغط للإخفاء' : 'مخفي من نقطة البيع — اضغط للإظهار'}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${value ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'right-0.5' : 'right-[22px]'}`} />
    </button>
  )
}

// مخزن المنتجات الجاهزة: أصناف بتتباع مباشرة من رصيدها (من غير توليفة استهلاك)
function DirectItemsPanel({ items, canEdit, router }: { items: CafeItem[]; canEdit: boolean; router: any }) {
  const direct = items.filter((i) => i.recipe.length === 0)
  const prepared = items.filter((i) => i.recipe.length > 0)
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 pb-2">
        <h3 className="text-sm font-bold text-[#1a1a2e]">مخزن المنتجات الجاهزة — بيع مباشر</h3>
        <p className="text-xs text-gray-400">أصناف بتتباع من رصيدها مباشرة · الأصناف اللي ليها توليفة بتتحضّر من مخزن المواد الخام</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
              <th className="p-3 font-medium">الصنف</th>
              <th className="p-3 font-medium">سعر البيع</th>
              <th className="p-3 font-medium">الرصيد</th>
              <th className="p-3 font-medium">يظهر في نقطة البيع</th>
            </tr>
          </thead>
          <tbody>
            {direct.length === 0 && (
              <tr><td colSpan={4} className="p-5 text-center text-gray-500">مفيش منتجات بيع مباشر — كل الأصناف الحالية بتتحضّر بتوليفة.</td></tr>
            )}
            {direct.map((it) => (
              <tr key={it.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 font-semibold">{it.name}</td>
                <td className="p-3 tabular-nums">{it.sellPrice.toLocaleString('ar-EG')} ج.م</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${it.stock <= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                    {it.stock} {it.unit}
                  </span>
                </td>
                <td className="p-3"><PosToggle id={it.id} value={it.showInPos} canEdit={canEdit} router={router} /></td>
              </tr>
            ))}
            {prepared.map((it) => (
              <tr key={it.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 font-semibold">{it.name}</td>
                <td className="p-3 tabular-nums">{it.sellPrice.toLocaleString('ar-EG')} ج.م</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700">تحضير من الخامات ({it.recipe.length} مكوّن)</span>
                </td>
                <td className="p-3"><PosToggle id={it.id} value={it.showInPos} canEdit={canEdit} router={router} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MaterialsTab({ materials, categories, units, canAdd, canDelete, router }: any) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState(units[0]?.name || '')
  const [costPrice, setCostPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!name.trim()) return setError('اسم الخامة مطلوب')
    setLoading(true)
    setError('')
    const res = await fetch('/api/cafe/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind: 'material', unit, costPrice, categoryId: categoryId || null }),
    })
    setLoading(false)
    if (!res.ok) return setError((await res.json()).error || 'فشل الحفظ')
    setName('')
    setCostPrice('')
    setCategoryId('')
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('حذف الخامة دي؟')) return
    await fetch(`/api/cafe/products/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-bold text-[#1a1a2e]">مخزن المواد الخام</h3>
          <p className="text-xs text-gray-400">خامات التحضير (شوكولاتة/حليب/مكونات) — بتتخصم تلقائي بتوليفة الاستهلاك عند البيع</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">الخامة</th>
                <th className="p-3 font-medium">الفئة</th>
                <th className="p-3 font-medium">الوحدة</th>
                <th className="p-3 font-medium">التكلفة</th>
                <th className="p-3 font-medium">الرصيد في مخزن الكافيه</th>
                <th className="p-3 font-medium no-print"></th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش خامات لسه — ضيف أول خامة (شوكولاتة، حليب، كريمة...).</td></tr>
              )}
              {materials.map((m: Material) => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold">{m.name}</td>
                  <td className="p-3">
                    {m.category ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{m.category}</span>
                    ) : (
                      <span className="text-xs text-gray-400">بدون فئة</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500">{m.unit}</td>
                  <td className="p-3 tabular-nums">{m.costPrice.toLocaleString('ar-EG')} ج.م</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${m.stock <= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {m.stock} {m.unit}
                    </span>
                  </td>
                  <td className="p-3 no-print">
                    {canDelete && (
                      <button onClick={() => remove(m.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canAdd && (
        <div className="bg-white p-5 rounded-xl shadow-sm space-y-3">
          <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-bold text-[#1a1a2e]">
            <span className="flex items-center gap-2"><Plus className="w-4 h-4 text-[#e94560]" /> إضافة خامة جديدة</span>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {open && (
            <div className="space-y-3 pt-2">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <input className={inputCls} placeholder="اسم الخامة (شوكولاتة، حليب...)" value={name} onChange={(e) => setName(e.target.value)} />
              <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">بدون فئة</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {units.map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
                <input className={inputCls} placeholder="سعر التكلفة" type="text" inputMode="decimal" dir="ltr" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
              </div>
              <button onClick={submit} disabled={loading} className="w-full bg-[#e94560] text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                {loading ? 'جارٍ الحفظ...' : 'حفظ الخامة'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MovementsPanel({ movements }: { movements: Movement[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 pb-2">
        <h3 className="text-sm font-bold text-[#1a1a2e]">آخر حركات الوارد على مخزن الكافيه</h3>
        <p className="text-xs text-gray-400">مصدر كل كمية — فاتورة شراء أو تحويل من مخزن تاني</p>
      </div>
      <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
        {movements.length === 0 && <p className="p-5 text-sm text-gray-500">مفيش حركات وارد لسه.</p>}
        {movements.map((mv) => (
          <div key={mv.id} className="p-3.5 px-4 flex justify-between items-start">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-green-700 tabular-nums">
                +{mv.quantity} {mv.unit} — {mv.productName}
              </p>
              <p className="text-xs text-gray-400 truncate">{mv.source}</p>
            </div>
            <span className="text-xs text-gray-400 tabular-nums shrink-0">
              {new Date(mv.createdAt).toLocaleDateString('ar-EG')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ItemsTab({ cafeItems, materials, categories, units, canAdd, canEdit, canDelete, router }: any) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState(units[0]?.name || '')
  const [sellPrice, setSellPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [showInPos, setShowInPos] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) return setError('اسم الصنف مطلوب')
    setLoading(true)
    setError('')
    const res = await fetch('/api/cafe/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind: 'item', unit, sellPrice, categoryId: categoryId || null, showInPos }),
    })
    setLoading(false)
    if (!res.ok) return setError((await res.json()).error || 'فشل الحفظ')
    setName('')
    setSellPrice('')
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('حذف الصنف ده؟')) return
    await fetch(`/api/cafe/products/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-3">
        {cafeItems.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500 text-sm">
            مفيش منتجات كافيه لسه — ضيف مشروب أو ديزرت وحدد توليفة استهلاكه من الخامات.
          </div>
        )}
        {cafeItems.map((item: CafeItem) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-bold text-[#1a1a2e]">{item.name}</p>
                <p className="text-xs text-gray-500">
                  سعر البيع: {item.sellPrice.toLocaleString('ar-EG')} ج.م ·{' '}
                  {item.recipe.length > 0 ? `${item.recipe.length} مكوّن في التوليفة` : `بيع مباشر — الرصيد: ${item.stock} ${item.unit}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 whitespace-nowrap hidden sm:inline">نقطة البيع</span>
                  <PosToggle id={item.id} value={item.showInPos} canEdit={canEdit} router={router} />
                </div>
                {canDelete && (
                  <button onClick={() => remove(item.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  className="text-xs font-semibold text-[#e94560] flex items-center gap-1"
                >
                  التوليفة {expanded === item.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {expanded === item.id && (
              <RecipeEditor productId={item.id} recipe={item.recipe} sellPrice={item.sellPrice} materials={materials} canEdit={canEdit} router={router} />
            )}
          </div>
        ))}
      </div>

      {canAdd && (
        <div className="bg-white p-5 rounded-xl shadow-sm space-y-3">
          <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-bold text-[#1a1a2e]">
            <span className="flex items-center gap-2"><Plus className="w-4 h-4 text-[#e94560]" /> إضافة منتج كافيه</span>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {open && (
            <div className="space-y-3 pt-2">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <input className={inputCls} placeholder="اسم المنتج (لاتيه، تشيز كيك...)" value={name} onChange={(e) => setName(e.target.value)} />
              <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">بدون فئة</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {units.map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
                <input className={inputCls} placeholder="سعر البيع" type="text" inputMode="decimal" dir="ltr" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={showInPos} onChange={(e) => setShowInPos(e.target.checked)} className="w-4 h-4 accent-[#e94560]" />
                يظهر في نقطة البيع
              </label>
              <button onClick={submit} disabled={loading} className="w-full bg-[#e94560] text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                {loading ? 'جارٍ الحفظ...' : 'حفظ المنتج'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecipeEditor({ productId, recipe, sellPrice, materials, canEdit, router }: any) {
  const [lines, setLines] = useState<{ materialId: string; quantity: string }[]>(
    recipe.length > 0 ? recipe.map((r: RecipeLine) => ({ materialId: r.materialId, quantity: String(r.quantity) })) : [{ materialId: '', quantity: '' }]
  )
  const [loading, setLoading] = useState(false)

  // تكلفة التوليفة لايف = مجموع (الكمية × تكلفة الخامة) — وهامش الربح مقابل سعر البيع
  const recipeCost = lines.reduce((s, l) => {
    const m = materials.find((mt: Material) => mt.id === l.materialId)
    return s + (m ? (Number(l.quantity) || 0) * m.costPrice : 0)
  }, 0)
  const margin = sellPrice - recipeCost
  const marginPct = sellPrice > 0 ? (margin / sellPrice) * 100 : 0

  function addLine() {
    setLines([...lines, { materialId: '', quantity: '' }])
  }
  function updateLine(i: number, field: string, value: string) {
    const next = [...lines]
    next[i] = { ...next[i], [field]: value }
    setLines(next)
  }
  function removeLine(i: number) {
    setLines(lines.filter((_, idx) => idx !== i))
  }

  async function save() {
    setLoading(true)
    await fetch(`/api/cafe/recipe/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: lines.filter((l) => l.materialId && Number(l.quantity) > 0) }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-2">
      <p className="text-xs font-semibold text-gray-500 mb-2">مكوّنات التوليفة — الكمية المستهلكة لكل وحدة مباعة</p>
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
            value={l.materialId}
            onChange={(e) => updateLine(i, 'materialId', e.target.value)}
            disabled={!canEdit}
          >
            <option value="">اختار خامة</option>
            {materials.map((m: Material) => (
              <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
            ))}
          </select>
          <input
            className="w-28 shrink-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
            type="text" inputMode="decimal" dir="ltr"
            placeholder="الكمية"
            value={l.quantity}
            onChange={(e) => updateLine(i, 'quantity', e.target.value)}
            disabled={!canEdit}
          />
          {canEdit && (
            <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {recipeCost > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-semibold tabular-nums">
            تكلفة التوليفة: {recipeCost.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م
          </span>
          <span className={`px-2.5 py-1 rounded-lg font-semibold tabular-nums ${margin >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            هامش الربح: {margin.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م ({marginPct.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%)
          </span>
        </div>
      )}
      {canEdit && (
        <div className="flex items-center gap-2 pt-2">
          <button onClick={addLine} className="text-xs font-semibold text-[#0f3460] flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> إضافة مكوّن
          </button>
          <button onClick={save} disabled={loading} className="mr-auto bg-[#e94560] text-white px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">
            {loading ? 'جارٍ الحفظ...' : 'حفظ التوليفة'}
          </button>
        </div>
      )}
    </div>
  )
}

function PurchasesTab({ purchases }: { purchases: CafePurchase[]; canAdd: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-[#0f3460]" />
          <h3 className="text-base font-bold text-[#1a1a2e]">مشتريات خامات الكافيه</h3>
        </div>
        <a href="/purchases" className="text-xs font-semibold text-[#e94560] hover:underline">
          إضافة أمر شراء من شاشة المشتريات ←
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
              <th className="p-3 font-medium">رقم الفاتورة</th>
              <th className="p-3 font-medium">المورد</th>
              <th className="p-3 font-medium">الخامات</th>
              <th className="p-3 font-medium">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-gray-500">مفيش مشتريات خامات كافيه لسه.</td></tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="p-3 font-semibold tabular-nums">{p.invoiceNo}</td>
                <td className="p-3">{p.supplier}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {p.items.map((it, i) => (
                      <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                        {it.name} {it.quantity} {it.unit}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 font-semibold tabular-nums">{p.total.toLocaleString('ar-EG')} ج.م</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
