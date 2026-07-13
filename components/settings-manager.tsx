'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Truck as TruckIcon,
  Package,
  Tags,
  Flame,
  Layers,
  Warehouse as WarehouseIcon,
  Pencil,
  Trash2,
  Plus,
  Star,
  ArrowLeft,
} from 'lucide-react'

/* ================= أنواع البيانات ================= */
interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  email: string | null
  rating: number
}
interface CategoryRow {
  id: string
  name: string
  productCount: number
}
interface ProductRow {
  id: string
  name: string
  type: string
  categoryId: string | null
  stageId: string | null
  costPrice: number
  sellPrice: number
  wholesalePrice: number
  minStock: number
  quantity: number
  unit: string
  imageUrl: string | null
}
interface StockStageRow {
  id: string
  name: string
  sortOrder: number
  sellable: boolean
  purchasable: boolean
  productCount: number
}
interface OperationRow {
  id: string
  name: string
  inputStageId: string | null
  outputStageId: string | null
  inputStageName: string | null
  outputStageName: string | null
  hasYieldLoss: boolean
  sortOrder: number
}

// تحويل صورة مرفوعة لـ data URL مضغوط عشان تتخزن في قاعدة البيانات
function fileToDataUrl(file: File, maxSize = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', 0.8))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
interface WarehouseRow {
  id: string
  name: string
  location: string | null
  isDefault: boolean
}

interface Props {
  suppliers: Supplier[]
  categories: CategoryRow[]
  products: ProductRow[]
  stockStages: StockStageRow[]
  operations: OperationRow[]
  warehouses: WarehouseRow[]
}

const TABS = [
  { key: 'products', label: 'الأصناف', Icon: Package },
  { key: 'categories', label: 'تصنيفات البيع', Icon: Tags },
  { key: 'stockStages', label: 'المراحل المخزنية', Icon: Layers },
  { key: 'operations', label: 'عمليات التصنيع', Icon: Flame },
  { key: 'suppliers', label: 'الموردين', Icon: TruckIcon },
  { key: 'warehouses', label: 'المخازن', Icon: WarehouseIcon },
] as const

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

async function apiCall(url: string, method: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'حصل خطأ')
  return data
}

export function SettingsManager({ suppliers, categories, products, stockStages, operations, warehouses }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('products')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 bg-white rounded-xl shadow-sm p-1.5">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === key ? 'bg-[#1a1a2e] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab products={products} categories={categories} stockStages={stockStages} />}
      {tab === 'categories' && <CategoriesTab categories={categories} />}
      {tab === 'stockStages' && <StockStagesTab stages={stockStages} />}
      {tab === 'operations' && <OperationsTab operations={operations} stages={stockStages} />}
      {tab === 'suppliers' && <SuppliersTab suppliers={suppliers} />}
      {tab === 'warehouses' && <WarehousesTab warehouses={warehouses} />}
    </div>
  )
}

/* ================= الأصناف ================= */
function ProductsTab({ products, categories, stockStages }: { products: ProductRow[]; categories: CategoryRow[]; stockStages: StockStageRow[] }) {
  const router = useRouter()
  const defaultStage = stockStages.find((s) => s.sellable)?.id || stockStages[0]?.id || ''
  const empty = { name: '', stageId: defaultStage, categoryId: '', costPrice: '', sellPrice: '', wholesalePrice: '', minStock: '0', unit: 'كجم', imageUrl: '' }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const startEdit = (p: ProductRow) => {
    setEditId(p.id)
    setForm({
      name: p.name,
      stageId: p.stageId || defaultStage,
      categoryId: p.categoryId || '',
      costPrice: String(p.costPrice),
      sellPrice: String(p.sellPrice),
      wholesalePrice: String(p.wholesalePrice),
      minStock: String(p.minStock),
      unit: p.unit,
      imageUrl: p.imageUrl || '',
    })
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
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiCall(editId ? `/api/products/${editId}` : '/api/products', editId ? 'PUT' : 'POST', form)
      setForm(empty)
      setEditId(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`متأكد من حذف الصنف "${name}"؟`)) return
    try {
      await apiCall(`/api/products/${id}`, 'DELETE')
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل صنف' : 'إضافة صنف جديد'}</h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">اسم الصنف</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">المرحلة المخزنية</label>
            <select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className={inputCls}>
              {stockStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.sellable ? ' (بيع)' : s.purchasable ? ' (شراء)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">تصنيف البيع</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputCls}>
              <option value="">بدون تصنيف</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">سعر التكلفة</label>
            <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الوحدة</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">سعر القطاعي</label>
            <input type="number" min="0" step="0.01" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">سعر الجملة</label>
            <input type="number" min="0" step="0.01" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الحد الأدنى</label>
            <input type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">صورة المنتج (هتظهر في نقطة البيع)</label>
          <div className="flex items-center gap-3">
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="معاينة" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-gray-50" />
            ) : (
              <div className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-xs">
                بدون
              </div>
            )}
            <div className="flex-1 space-y-1.5">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImage(e.target.files?.[0])}
                className="block w-full text-xs text-gray-500 file:ml-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#0f3460] file:text-white file:text-xs file:font-semibold file:cursor-pointer"
              />
              {form.imageUrl && (
                <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })} className="text-xs text-red-500 hover:underline">
                  حذف الصورة
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
            {loading ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة الصنف'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm(empty) }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
              إلغاء
            </button>
          )}
        </div>
      </form>

      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
        <h3 className="text-base font-bold text-[#1a1a2e] p-5 pb-3">الأصناف ({products.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">الصنف</th>
                <th className="p-3 font-medium">المرحلة المخزنية</th>
                <th className="p-3 font-medium">تصنيف البيع</th>
                <th className="p-3 font-medium">قطاعي</th>
                <th className="p-3 font-medium">جملة</th>
                <th className="p-3 font-medium">الرصيد</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold">
                    <div className="flex items-center gap-2">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="w-8 h-8 object-contain rounded bg-gray-50 shrink-0" />
                      )}
                      {p.name}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {stockStages.find((s) => s.id === p.stageId)?.name || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">{categories.find((c) => c.id === p.categoryId)?.name || '—'}</td>
                  <td className="p-3 tabular-nums">{p.sellPrice.toFixed(2)}</td>
                  <td className="p-3 tabular-nums">{p.wholesalePrice.toFixed(2)}</td>
                  <td className="p-3 tabular-nums font-semibold">{p.quantity} {p.unit}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => startEdit(p)} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(p.id, p.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">مفيش أصناف — ضيف أول صنف من الفورم.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ================= التصنيفات ================= */
function CategoriesTab({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await apiCall(editId ? `/api/categories/${editId}` : '/api/categories', editId ? 'PUT' : 'POST', { name })
      setName('')
      setEditId(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const remove = async (id: string, catName: string) => {
    if (!confirm(`متأكد من حذف التصنيف "${catName}"؟ المنتجات المرتبطة هتبقى بدون تصنيف.`)) return
    try {
      await apiCall(`/api/categories/${id}`, 'DELETE')
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل تصنيف' : 'إضافة تصنيف'}</h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: بن مطحون، بن حبوب، هدايا..." className={inputCls} />
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">
            {editId ? 'حفظ' : 'إضافة'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setName('') }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>
          )}
        </div>
      </form>

      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-3">التصنيفات ({categories.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
              <div>
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-xs text-gray-400">{c.productCount} صنف</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditId(c.id); setName(c.name) }} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(c.id, c.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="text-sm text-gray-500 col-span-full">مفيش تصنيفات لسه.</p>}
        </div>
      </div>
    </div>
  )
}

/* ================= الموردين ================= */
function SuppliersTab({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter()
  const empty = { name: '', phone: '', address: '', email: '', rating: '5' }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await apiCall(editId ? `/api/suppliers/${editId}` : '/api/suppliers', editId ? 'PUT' : 'POST', form)
      setForm(empty)
      setEditId(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`متأكد من حذف المورد "${name}"؟`)) return
    try {
      await apiCall(`/api/suppliers/${id}`, 'DELETE')
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل مورد' : 'إضافة مورد جديد'}</h3>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">اسم المورد</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">التليفون</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">العنوان</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الإيميل</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">التقييم (1-5)</label>
            <input type="number" min="1" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">
            {editId ? 'حفظ التعديلات' : 'إضافة المورد'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm(empty) }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>
          )}
        </div>
      </form>

      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
        <h3 className="text-base font-bold text-[#1a1a2e] p-5 pb-3">الموردين ({suppliers.length})</h3>
        <div className="divide-y divide-gray-50">
          {suppliers.map((s) => (
            <div key={s.id} className="p-4 px-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {s.phone || 'بدون تليفون'} · {s.address || 'بدون عنوان'} {s.email ? `· ${s.email}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < s.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                  ))}
                </div>
                <button onClick={() => { setEditId(s.id); setForm({ name: s.name, phone: s.phone || '', address: s.address || '', email: s.email || '', rating: String(s.rating) }) }}
                  className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(s.id, s.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && <p className="p-5 text-sm text-gray-500">مفيش موردين — ضيف أول مورد.</p>}
        </div>
      </div>
    </div>
  )
}

/* ================= المراحل المخزنية ================= */
function StockStagesTab({ stages }: { stages: StockStageRow[] }) {
  const router = useRouter()
  const empty = { name: '', sortOrder: '0', sellable: false, purchasable: false }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await apiCall(editId ? `/api/stock-stages/${editId}` : '/api/stock-stages', editId ? 'PUT' : 'POST', {
        ...form,
        sortOrder: Number(form.sortOrder),
      })
      setForm(empty)
      setEditId(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`متأكد من حذف مرحلة "${name}"؟`)) return
    try {
      await apiCall(`/api/stock-stages/${id}`, 'DELETE')
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل مرحلة' : 'مرحلة مخزنية جديدة'}</h3>
        <p className="text-xs text-gray-500">
          التصنيف المخزني للبضاعة (بن أخضر / محمّص / مطحون / نهائي). كل صنف بينتمي لمرحلة، والتصنيع بيسحب وينتج بين المراحل.
        </p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم المرحلة (مثال: بن محمّص)" className={inputCls} />
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">الترتيب</label>
          <input type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.purchasable} onChange={(e) => setForm({ ...form, purchasable: e.target.checked })} className="w-4 h-4 accent-[#e94560]" />
          يدخل بأمر شراء (خامة تُشترى من مورد)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.sellable} onChange={(e) => setForm({ ...form, sellable: e.target.checked })} className="w-4 h-4 accent-[#e94560]" />
          يظهر في المبيعات ونقطة البيع
        </label>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">
            {editId ? 'حفظ' : 'إضافة'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm(empty) }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>
          )}
        </div>
      </form>

      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-3">المراحل المخزنية ({stages.length})</h3>
        <div className="space-y-2">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    {s.purchasable && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold">شراء</span>}
                    {s.sellable && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-semibold">بيع</span>}
                    <span className="text-[10px] text-gray-400">{s.productCount} صنف</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditId(s.id); setForm({ name: s.name, sortOrder: String(s.sortOrder), sellable: s.sellable, purchasable: s.purchasable }) }} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(s.id, s.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ================= عمليات التصنيع ================= */
function OperationsTab({ operations, stages }: { operations: OperationRow[]; stages: StockStageRow[] }) {
  const router = useRouter()
  const empty = { name: '', inputStageId: '', outputStageId: '', hasYieldLoss: false, sortOrder: '0' }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await apiCall(editId ? `/api/operations/${editId}` : '/api/operations', editId ? 'PUT' : 'POST', {
        ...form,
        sortOrder: Number(form.sortOrder),
      })
      setForm(empty)
      setEditId(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`متأكد من حذف عملية "${name}"؟`)) return
    try {
      await apiCall(`/api/operations/${id}`, 'DELETE')
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل عملية' : 'عملية تصنيع جديدة'}</h3>
        <p className="text-xs text-gray-500">
          كل عملية بتحدد: بتسحب من أنهي مرحلة مخزنية وبتنتج في أنهي مرحلة. مثال: "تحميص" تسحب من (بن أخضر) وتنتج (بن محمّص).
        </p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم العملية (مثال: تحميص، طحن، تعبئة)" className={inputCls} />
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">تسحب من مرحلة</label>
          <select value={form.inputStageId} onChange={(e) => setForm({ ...form, inputStageId: e.target.value })} className={inputCls}>
            <option value="">اختار المرحلة</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">تنتج في مرحلة</label>
          <select value={form.outputStageId} onChange={(e) => setForm({ ...form, outputStageId: e.target.value })} className={inputCls}>
            <option value="">اختار المرحلة</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.hasYieldLoss} onChange={(e) => setForm({ ...form, hasYieldLoss: e.target.checked })} className="w-4 h-4 accent-[#e94560]" />
          فيها هدر في الوزن (زي التحميص 15-20%)
        </label>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">
            {editId ? 'حفظ' : 'إضافة'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm(empty) }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>
          )}
        </div>
      </form>

      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-3">عمليات التصنيع ({operations.length})</h3>
        <div className="space-y-2">
          {operations.map((op) => (
            <div key={op.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm flex items-center gap-2">
                  {op.name}
                  {op.hasYieldLoss && <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-semibold">هدر</span>}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">{op.inputStageName || '؟'}</span>
                  <ArrowLeft className="w-3 h-3" />
                  <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{op.outputStageName || '؟'}</span>
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditId(op.id); setForm({ name: op.name, inputStageId: op.inputStageId || '', outputStageId: op.outputStageId || '', hasYieldLoss: op.hasYieldLoss, sortOrder: String(op.sortOrder) }) }} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(op.id, op.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {operations.length === 0 && (
            <p className="text-sm text-gray-500">مفيش عمليات معرّفة — ضيف عملياتك (تحميص، طحن، تعبئة).</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================= المخازن ================= */
function WarehousesTab({ warehouses }: { warehouses: WarehouseRow[] }) {
  const router = useRouter()
  const empty = { name: '', location: '', isDefault: false }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await apiCall(editId ? `/api/warehouses/${editId}` : '/api/warehouses', editId ? 'PUT' : 'POST', form)
      setForm(empty)
      setEditId(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`متأكد من حذف المخزن "${name}"؟`)) return
    try {
      await apiCall(`/api/warehouses/${id}`, 'DELETE')
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm space-y-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">{editId ? 'تعديل مخزن' : 'إضافة مخزن جديد'}</h3>
        <p className="text-xs text-gray-500">كل عمليات الشراء والتصنيع والبيع والتحميل بتحدد المخزن اللي بتتعامل معاه.</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">اسم المخزن</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: مخزن الفرع الرئيسي" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">الموقع</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="w-4 h-4 accent-[#e94560]" />
          المخزن الافتراضي للعمليات
        </label>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] text-sm">
            {editId ? 'حفظ' : 'إضافة'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm(empty) }} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">إلغاء</button>
          )}
        </div>
      </form>

      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-base font-bold text-[#1a1a2e] mb-3">المخازن ({warehouses.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {warehouses.map((w) => (
            <div key={w.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#0f3460]/5 flex items-center justify-center shrink-0">
                  <WarehouseIcon className="w-5 h-5 text-[#0f3460]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    {w.name}
                    {w.isDefault && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-semibold">افتراضي</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{w.location || 'بدون موقع'}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditId(w.id); setForm({ name: w.name, location: w.location || '', isDefault: w.isDefault }) }} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(w.id, w.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
