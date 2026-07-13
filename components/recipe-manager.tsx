'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookMarked, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { ROAST_LEVELS, GRIND_TYPES } from '@/components/production-form'

interface ProductLite {
  id: string
  name: string
  type: string
}
export interface RecipeRow {
  id: string
  name: string
  lineType: string
  outputName: string | null
  roastLevel: string | null
  grindType: string | null
  expectedWaste: number
  notes: string | null
  items: { productId: string; percentage: number; productName: string }[]
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

export function RecipeManager({ recipes, products }: { recipes: RecipeRow[]; products: ProductLite[] }) {
  const router = useRouter()
  const empty = {
    name: '',
    lineType: 'PROCESSING',
    outputName: '',
    roastLevel: '',
    grindType: GRIND_TYPES[1],
    expectedWaste: '0',
    notes: '',
    items: [{ productId: '', percentage: '' }],
  }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const totalPct = form.items.reduce((s: number, i: any) => s + (Number(i.percentage) || 0), 0)

  const startEdit = (r: RecipeRow) => {
    setEditId(r.id)
    setForm({
      name: r.name,
      lineType: r.lineType,
      outputName: r.outputName || '',
      roastLevel: r.roastLevel || '',
      grindType: r.grindType || GRIND_TYPES[1],
      expectedWaste: String(r.expectedWaste),
      notes: r.notes || '',
      items: r.items.map((it) => ({ productId: it.productId, percentage: String(it.percentage) })),
    })
    setOpen(true)
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch(editId ? `/api/recipes/${editId}` : '/api/recipes', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        expectedWaste: Number(form.expectedWaste) || 0,
        items: form.items.map((i: any) => ({ productId: i.productId, percentage: Number(i.percentage) })),
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setForm(empty)
    setEditId(null)
    setOpen(false)
    router.refresh()
  }

  const remove = async (r: RecipeRow) => {
    if (!confirm(`متأكد من حذف الوصفة "${r.name}"؟`)) return
    const res = await fetch(`/api/recipes/${r.id}`, { method: 'DELETE' })
    if (!res.ok) { alert('حصل خطأ في الحذف'); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-[#0f3460]" />
          <h3 className="text-base font-bold text-[#1a1a2e]">الوصفات والخلطات (BOM) — {recipes.length}</h3>
        </div>
        {!open && (
          <button onClick={() => { setOpen(true); setEditId(null); setForm(empty) }} className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2545]">
            <Plus className="w-4 h-4" /> وصفة جديدة
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mx-5 mb-4 border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-[#1a1a2e]">{editId ? `تعديل: ${form.name}` : 'وصفة جديدة'}</h4>
            <button type="button" onClick={() => { setOpen(false); setEditId(null) }} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <input placeholder="اسم الوصفة (مثال: خلطة تركي فاتح)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            <input placeholder="اسم المنتج النهائي (اختياري)" value={form.outputName} onChange={(e) => setForm({ ...form, outputName: e.target.value })} className={inputCls} />
            <select value={form.lineType} onChange={(e) => setForm({ ...form, lineType: e.target.value })} className={inputCls}>
              <option value="PROCESSING">خط الخلط والطحن</option>
              <option value="ROASTING">خط التحميص</option>
            </select>
            {form.lineType === 'ROASTING' ? (
              <select value={form.roastLevel} onChange={(e) => setForm({ ...form, roastLevel: e.target.value })} className={inputCls}>
                <option value="">درجة التحميص</option>
                {ROAST_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <select value={form.grindType} onChange={(e) => setForm({ ...form, grindType: e.target.value })} className={inputCls}>
                {GRIND_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">مكونات الخلطة (النسب %)</label>
              <span className={`text-xs font-bold tabular-nums ${Math.abs(totalPct - 100) < 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                المجموع: {totalPct.toFixed(1)}%
              </span>
            </div>
            {form.items.map((it: any, i: number) => (
              <div key={i} className="flex gap-2">
                <select
                  value={it.productId}
                  onChange={(e) => setForm({ ...form, items: form.items.map((x: any, j: number) => (j === i ? { ...x, productId: e.target.value } : x)) })}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
                >
                  <option value="">اختار الخامة</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                  type="number" min="0" max="100" step="0.5" placeholder="%"
                  value={it.percentage}
                  onChange={(e) => setForm({ ...form, items: form.items.map((x: any, j: number) => (j === i ? { ...x, percentage: e.target.value } : x)) })}
                  className="w-20 shrink-0 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm tabular-nums"
                />
                {form.items.length > 1 && (
                  <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_: any, j: number) => j !== i) })} className="shrink-0 text-red-500" aria-label="حذف">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { productId: '', percentage: '' }] })} className="flex items-center gap-1 text-sm text-[#0f3460] font-medium">
              <Plus className="w-4 h-4" /> إضافة مكوّن
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">نسبة الهدر المتوقعة %</label>
              <input type="number" min="0" max="100" step="0.5" value={form.expectedWaste} onChange={(e) => setForm({ ...form, expectedWaste: e.target.value })} className={inputCls} />
            </div>
            <input placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputCls} self-end`} />
          </div>

          <button type="submit" disabled={loading} className="w-full md:w-auto px-8 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
            {loading ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'حفظ الوصفة'}
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-50">
        {recipes.length === 0 && !open && (
          <p className="p-6 text-sm text-gray-500 text-center">مفيش وصفات لسه — احفظ خلطاتك المتكررة عشان تستخدمها بسرعة في التصنيع.</p>
        )}
        {recipes.map((r) => (
          <div key={r.id} className="p-4 px-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-[#1a1a2e]">
                {r.name}
                <span className={`mr-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${r.lineType === 'ROASTING' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                  {r.lineType === 'ROASTING' ? 'تحميص' : 'خلط وطحن'}
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {r.items.map((it) => (
                  <span key={it.productId} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded tabular-nums">
                    {it.productName} {it.percentage}%
                  </span>
                ))}
              </div>
              {(r.roastLevel || r.grindType) && (
                <p className="text-xs text-gray-400 mt-1">{r.roastLevel || r.grindType}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => startEdit(r)} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
