'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react'
import { WarehouseTabs } from '@/components/warehouse-tabs'

interface Material {
  id: string; name: string; unit: string; costPrice: number; stock: number
  minStock?: number
  stocks?: { warehouseId: string; quantity: number }[]
}
interface RecipeLine { materialId: string; materialName: string; unit: string; quantity: number }
interface CafeItem { id: string; name: string; unit: string; sellPrice: number; categoryId: string | null; recipe: RecipeLine[] }
interface CafePurchase {
  id: string; invoiceNo: string; supplier: string; total: number; createdAt: string
  items: { name: string; quantity: number; unit: string }[]
}
interface Props {
  warehouses: { id: string; name: string; isDefault: boolean }[]
  materials: Material[]
  cafeItems: CafeItem[]
  categories: { id: string; name: string }[]
  purchases: CafePurchase[]
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'
const TABS = ['warehouse', 'materials', 'items', 'purchases'] as const

export function CafeManager({ warehouses, materials, cafeItems, categories, purchases, canAdd, canEdit, canDelete }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<(typeof TABS)[number]>('warehouse')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'warehouse', label: 'مخزن الكافيه' },
          { key: 'materials', label: `الخامات (${materials.length})` },
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

      {tab === 'warehouse' && (
        warehouses.length > 0 ? (
          <WarehouseTabs
            warehouses={warehouses}
            products={materials.map((m) => ({
              id: m.id,
              name: m.name,
              unit: m.unit,
              minStock: m.minStock ?? 0,
              costPrice: m.costPrice,
              stocks: m.stocks ?? [],
            }))}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500 text-sm">جاري إنشاء مخزن الكافيه...</div>
        )
      )}
      {tab === 'materials' && <MaterialsTab materials={materials} canAdd={canAdd} canDelete={canDelete} router={router} />}
      {tab === 'items' && (
        <ItemsTab cafeItems={cafeItems} materials={materials} categories={categories} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} router={router} />
      )}
      {tab === 'purchases' && <PurchasesTab purchases={purchases} canAdd={canAdd} />}
    </div>
  )
}

function MaterialsTab({ materials, canAdd, canDelete, router }: any) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('كجم')
  const [costPrice, setCostPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!name.trim()) return setError('اسم الخامة مطلوب')
    setLoading(true)
    setError('')
    const res = await fetch('/api/cafe/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind: 'material', unit, costPrice }),
    })
    setLoading(false)
    if (!res.ok) return setError((await res.json()).error || 'فشل الحفظ')
    setName('')
    setCostPrice('')
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">الخامة</th>
                <th className="p-3 font-medium">الوحدة</th>
                <th className="p-3 font-medium">التكلفة</th>
                <th className="p-3 font-medium">الرصيد في مخزن الكافيه</th>
                <th className="p-3 font-medium no-print"></th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">مفيش خامات لسه — ضيف أول خامة (شوكولاتة، حليب، كريمة...).</td></tr>
              )}
              {materials.map((m: Material) => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold">{m.name}</td>
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
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="الوحدة" value={unit} onChange={(e) => setUnit(e.target.value)} />
                <input className={inputCls} placeholder="سعر التكلفة" type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
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

function ItemsTab({ cafeItems, materials, categories, canAdd, canEdit, canDelete, router }: any) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('قطعة')
  const [sellPrice, setSellPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
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
      body: JSON.stringify({ name, kind: 'item', unit, sellPrice, categoryId: categoryId || null }),
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
                <p className="text-xs text-gray-500">سعر البيع: {item.sellPrice.toLocaleString('ar-EG')} ج.م · {item.recipe.length} مكوّن في التوليفة</p>
              </div>
              <div className="flex items-center gap-2">
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
              <RecipeEditor productId={item.id} recipe={item.recipe} materials={materials} canEdit={canEdit} router={router} />
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
                <input className={inputCls} placeholder="الوحدة" value={unit} onChange={(e) => setUnit(e.target.value)} />
                <input className={inputCls} placeholder="سعر البيع" type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
              </div>
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

function RecipeEditor({ productId, recipe, materials, canEdit, router }: any) {
  const [lines, setLines] = useState<{ materialId: string; quantity: string }[]>(
    recipe.length > 0 ? recipe.map((r: RecipeLine) => ({ materialId: r.materialId, quantity: String(r.quantity) })) : [{ materialId: '', quantity: '' }]
  )
  const [loading, setLoading] = useState(false)

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
            type="number"
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
