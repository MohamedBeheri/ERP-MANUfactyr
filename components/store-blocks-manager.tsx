'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutTemplate, Plus, Trash2, Pencil, X, Star, Flame, Award, Footprints, MessageSquareQuote } from 'lucide-react'

export interface BlockRow {
  id: string
  kind: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  link: string | null
  rating: number
  sortOrder: number
}

const KINDS = [
  { key: 'ROAST_CARD', label: 'كروت التحميص', Icon: Flame, hint: 'مثال: فاتح — نكهات فاكهية مشرقة' },
  { key: 'BRAND_CARD', label: 'خطوط المنتجات', Icon: Award, hint: 'مثال: جولد — قهوة تركية فاخرة' },
  { key: 'LOYALTY_STEP', label: 'خطوات الولاء', Icon: Footprints, hint: 'مثال: اشرب ← جمّع نقاط ← استبدلها' },
  { key: 'REVIEW', label: 'آراء العملاء', Icon: MessageSquareQuote, hint: 'اسم العميل + رأيه + تقييم بالنجوم' },
] as const

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

function fileToDataUrl(file: File, maxSize = 600): Promise<string> {
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

export function StoreBlocksManager({ blocks }: { blocks: BlockRow[] }) {
  const router = useRouter()
  const [kind, setKind] = useState<string>('ROAST_CARD')
  const empty = { title: '', subtitle: '', imageUrl: '', link: '', rating: '5', sortOrder: '0' }
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const active = KINDS.find((k) => k.key === kind)!
  const list = blocks.filter((b) => b.kind === kind)
  const isReview = kind === 'REVIEW'

  const handleImage = async (file?: File) => {
    if (!file) return
    try {
      const imageUrl = await fileToDataUrl(file)
      setForm((f: any) => ({ ...f, imageUrl }))
    } catch { setError('فشل تحميل الصورة') }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch(editId ? `/api/store-blocks/${editId}` : '/api/store-blocks', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, kind, rating: Number(form.rating), sortOrder: Number(form.sortOrder) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setForm(empty); setEditId(null); setOpen(false); router.refresh()
  }

  const startEdit = (b: BlockRow) => {
    setEditId(b.id)
    setForm({ title: b.title, subtitle: b.subtitle || '', imageUrl: b.imageUrl || '', link: b.link || '', rating: String(b.rating), sortOrder: String(b.sortOrder) })
    setOpen(true); setError('')
  }

  const remove = async (b: BlockRow) => {
    if (!confirm(`حذف "${b.title}"؟`)) return
    await fetch(`/api/store-blocks/${b.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3">
        <LayoutTemplate className="w-5 h-5 text-[#0f3460]" />
        <h3 className="text-base font-bold text-[#1a1a2e]">أقسام الموقع (محتوى ديناميكي)</h3>
      </div>

      {/* تبويبات الأنواع */}
      <div className="flex flex-wrap gap-1 px-5 pb-3">
        {KINDS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => { setKind(key); setOpen(false); setEditId(null) }} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${kind === key ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
            <span className="opacity-60">({blocks.filter((b) => b.kind === key).length})</span>
          </button>
        ))}
      </div>

      <div className="px-5 pb-3">
        <p className="text-xs text-gray-400">{active.hint}</p>
      </div>

      {open ? (
        <form onSubmit={submit} className="mx-5 mb-4 border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-[#1a1a2e]">{editId ? 'تعديل' : `إضافة — ${active.label}`}</h4>
            <button type="button" onClick={() => { setOpen(false); setEditId(null); setForm(empty) }} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-4 h-4" /></button>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input placeholder={isReview ? 'اسم العميل' : 'العنوان'} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
            <input placeholder="الترتيب" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inputCls} />
          </div>
          <textarea placeholder={isReview ? 'رأي العميل' : 'الوصف'} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
          {isReview ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">التقييم (1-5 نجوم)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, rating: String(n) })} aria-label={`${n} نجوم`}>
                    <Star className={`w-6 h-6 ${n <= Number(form.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">صورة (اختياري)</label>
                <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} className="block w-full text-xs text-gray-500 file:ml-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#0f3460] file:text-white file:text-xs file:font-semibold file:cursor-pointer" />
              </div>
              {form.imageUrl && (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="" className="w-14 h-14 object-cover rounded-lg border" />
                  <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })} className="text-xs text-red-500 hover:underline">حذف</button>
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={loading} className="w-full md:w-auto px-8 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
            {loading ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة'}
          </button>
        </form>
      ) : (
        <div className="px-5 pb-3">
          <button onClick={() => { setOpen(true); setForm(empty); setEditId(null) }} className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2545]">
            <Plus className="w-4 h-4" /> إضافة {active.label.slice(0, -1) || 'عنصر'}
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-50 pb-2">
        {list.length === 0 && !open && <p className="px-5 py-4 text-sm text-gray-400">مفيش عناصر لسه — ضيف أول عنصر.</p>}
        {list.map((b) => (
          <div key={b.id} className="px-5 py-3 flex items-center gap-3">
            {b.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{b.title}</p>
              {b.subtitle && <p className="text-xs text-gray-400 truncate">{b.subtitle}</p>}
            </div>
            {b.kind === 'REVIEW' && (
              <div className="flex gap-0.5 shrink-0">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < b.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />)}
              </div>
            )}
            <div className="flex gap-1 shrink-0">
              <button onClick={() => startEdit(b)} className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded" aria-label="تعديل"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(b)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
