'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Images, Plus, Trash2, Video, ImageIcon, X } from 'lucide-react'

export interface HeroSlideRow {
  id: string
  type: string
  media: string
  badge: string | null
  title1: string | null
  title2: string | null
  subtitle: string | null
  ctaText: string | null
  ctaLink: string | null
  sortOrder: number
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

function fileToDataUrl(file: File, maxSize = 1400): Promise<string> {
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
        resolve(canvas.toDataURL('image/webp', 0.82))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function HeroManager({ slides }: { slides: HeroSlideRow[] }) {
  const router = useRouter()
  const empty = { type: 'IMAGE', media: '', badge: '', title1: '', title2: '', subtitle: '', ctaText: '', ctaLink: '/store', sortOrder: '0' }
  const [form, setForm] = useState<any>(empty)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImage = async (file?: File) => {
    if (!file) return
    try {
      const media = await fileToDataUrl(file)
      setForm((f: any) => ({ ...f, media, type: 'IMAGE' }))
    } catch {
      setError('فشل تحميل الصورة')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.media) { setError('ارفع صورة أو حط رابط فيديو'); return }
    setLoading(true)
    const res = await fetch('/api/hero-slides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'فشل الحفظ'); return }
    setForm(empty); setOpen(false); router.refresh()
  }

  const remove = async (id: string) => {
    if (!confirm('حذف الشريحة دي من البانر؟')) return
    await fetch(`/api/hero-slides/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <Images className="w-5 h-5 text-[#0f3460]" />
          <h3 className="text-base font-bold text-[#1a1a2e]">بانر الرئيسية (سلايدر) — {slides.length}</h3>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2545]">
            <Plus className="w-4 h-4" /> شريحة جديدة
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mx-5 mb-4 border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-[#1a1a2e]">إضافة شريحة للبانر</h4>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-4 h-4" /></button>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, type: 'IMAGE', media: '' })} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border ${form.type === 'IMAGE' ? 'border-[#e94560] bg-[#e94560]/5 text-[#e94560]' : 'border-gray-200 text-gray-500'}`}>
              <ImageIcon className="w-4 h-4" /> صورة
            </button>
            <button type="button" onClick={() => setForm({ ...form, type: 'VIDEO', media: '' })} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border ${form.type === 'VIDEO' ? 'border-[#0f3460] bg-[#0f3460]/5 text-[#0f3460]' : 'border-gray-200 text-gray-500'}`}>
              <Video className="w-4 h-4" /> فيديو
            </button>
          </div>

          {form.type === 'IMAGE' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">صورة البانر</label>
              <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} className="block w-full text-xs text-gray-500 file:ml-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#0f3460] file:text-white file:text-xs file:font-semibold file:cursor-pointer" />
              {form.media && <img src={form.media} alt="" className="mt-2 w-full h-28 object-cover rounded-lg" />}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">رابط الفيديو (mp4 مباشر)</label>
              <input value={form.media} onChange={(e) => setForm({ ...form, media: e.target.value })} placeholder="https://.../video.mp4" className={inputCls} dir="ltr" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input placeholder="بادچ (اختياري)" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className={inputCls} />
            <input placeholder="الترتيب" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inputCls} />
            <input placeholder="العنوان الأول" value={form.title1} onChange={(e) => setForm({ ...form, title1: e.target.value })} className={inputCls} />
            <input placeholder="العنوان الثاني (مميّز)" value={form.title2} onChange={(e) => setForm({ ...form, title2: e.target.value })} className={inputCls} />
          </div>
          <input placeholder="وصف صغير" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="نص الزرار (مثال: تسوّق دلوقتي)" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} className={inputCls} />
            <input placeholder="رابط الزرار" value={form.ctaLink} onChange={(e) => setForm({ ...form, ctaLink: e.target.value })} className={inputCls} dir="ltr" />
          </div>

          <button type="submit" disabled={loading} className="w-full md:w-auto px-8 bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold hover:bg-[#0a2545] disabled:opacity-50 text-sm">
            {loading ? 'جاري الحفظ...' : 'إضافة الشريحة'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 pt-0">
        {slides.length === 0 && !open && <p className="text-sm text-gray-500 col-span-full text-center py-6">مفيش شرائح — ضيف صور/فيديو للبانر الرئيسي.</p>}
        {slides.map((s) => (
          <div key={s.id} className="relative rounded-xl overflow-hidden border border-gray-100 group">
            {s.type === 'VIDEO' ? (
              <div className="h-32 bg-gray-900 flex items-center justify-center text-white/60"><Video className="w-8 h-8" /></div>
            ) : (
              <img src={s.media} alt="" className="h-32 w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-2 right-3 left-3 text-white">
              {s.badge && <span className="text-[10px] bg-[#e9b44c] text-black px-1.5 py-0.5 rounded font-bold">{s.badge}</span>}
              <p className="font-bold text-sm truncate mt-0.5">{s.title1 || 'بدون عنوان'} {s.title2}</p>
            </div>
            <button onClick={() => remove(s.id)} className="absolute top-2 left-2 w-8 h-8 rounded-lg bg-black/50 text-white flex items-center justify-center hover:bg-red-600" aria-label="حذف">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
