'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Coffee,
  ShoppingBag,
  Heart,
  Plus,
  Minus,
  Trash2,
  X,
  Search,
  Phone,
  MessageCircle,
  CheckCircle2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Home,
  Grid3x3,
  Clock,
  Truck,
  ShieldCheck,
} from 'lucide-react'

interface StoreProduct { id: string; name: string; unit: string; price: number; stock: number; categoryId: string | null; imageUrl: string | null }
interface Category { id: string; name: string }
interface Slide { id: string; type: string; media: string; badge: string | null; title1: string | null; title2: string | null; subtitle: string | null; ctaText: string | null; ctaLink: string | null }
interface Settings {
  storeName: string; tagline: string; heroImage: string | null; phone: string | null; whatsapp: string | null; address: string | null
  deliveryFee: number; minOrder: number; isOpen: boolean; showOutOfStock: boolean
}
interface CartLine { productId: string; name: string; price: number; unit: string; quantity: number; stock: number; imageUrl: string | null }

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const CART_KEY = 'albadr-cart'
const WISH_KEY = 'albadr-wishlist'

export function Storefront({ settings, products, categories, slides }: { settings: Settings; products: StoreProduct[]; categories: Category[]; slides: Slide[] }) {
  const [tab, setTab] = useState<'home' | 'products' | 'contact'>('home')
  const [cart, setCart] = useState<CartLine[]>([])
  const [wish, setWish] = useState<string[]>([])
  const [drawer, setDrawer] = useState<null | 'cart' | 'wish'>(null)
  const [checkout, setCheckout] = useState(false)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [form, setForm] = useState({ customerName: '', phone: '', address: '', notes: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    try {
      const c = localStorage.getItem(CART_KEY); if (c) setCart(JSON.parse(c))
      const w = localStorage.getItem(WISH_KEY); if (w) setWish(JSON.parse(w))
    } catch {}
  }, [])
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem(WISH_KEY, JSON.stringify(wish)) }, [wish])

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const filtered = useMemo(
    () => products.filter((p) => p.name.includes(search.trim()) && (!cat || p.categoryId === cat)),
    [products, search, cat]
  )
  const featured = products.slice(0, 8)

  const add = (p: StoreProduct) => {
    if (p.stock <= 0) return
    setCart((prev) => {
      const ex = prev.find((c) => c.productId === p.id)
      if (ex) { if (ex.quantity >= p.stock) return prev; return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c)) }
      return [...prev, { productId: p.id, name: p.name, price: p.price, unit: p.unit, quantity: 1, stock: p.stock, imageUrl: p.imageUrl }]
    })
    setDrawer('cart')
  }
  const changeQty = (id: string, d: number) =>
    setCart((prev) => prev.map((c) => (c.productId === id ? { ...c, quantity: Math.min(c.stock, Math.max(0, c.quantity + d)) } : c)).filter((c) => c.quantity > 0))
  const removeCart = (id: string) => setCart((prev) => prev.filter((c) => c.productId !== id))
  const toggleWish = (id: string) => setWish((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const count = cart.reduce((s, c) => s + c.quantity, 0)
  const total = subtotal + (subtotal > 0 ? settings.deliveryFee : 0)
  const wishProducts = wish.map((id) => productById.get(id)).filter(Boolean) as StoreProduct[]

  const goProducts = (categoryId?: string) => { setCat(categoryId || ''); setTab('products'); window.scrollTo({ top: 0 }) }

  const submit = async () => {
    setError('')
    if (!form.customerName || !form.phone || !form.address) { setError('اكتب الاسم والتليفون والعنوان'); return }
    if (settings.minOrder > 0 && subtotal < settings.minOrder) { setError(`الحد الأدنى للطلب ${fmt(settings.minOrder)} ج.م`); return }
    setLoading(true)
    const res = await fetch('/api/store/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'فشل الطلب'); return }
    setDone(data.orderNo); setCart([]); setCheckout(false); setDrawer(null)
  }

  const waLink = settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}` : null

  const NAV = [
    { key: 'home', label: 'الرئيسية', Icon: Home },
    { key: 'products', label: 'المنتجات', Icon: Grid3x3 },
    { key: 'contact', label: 'اتصل بنا', Icon: Phone },
  ] as const

  const cardOf = (p: StoreProduct) => {
    const out = p.stock <= 0
    const wished = wish.includes(p.id)
    return (
      <div key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141416] transition hover:-translate-y-1 hover:border-[#e9b44c]/40">
        <div className="relative">
          <div className="flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-[#1b1b1e] to-[#0a0a0b]">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
            ) : <Coffee className="w-16 h-16 text-white/15 transition group-hover:scale-110" />}
          </div>
          {out && <span className="absolute top-3 left-3 rounded-md bg-black/80 px-2 py-0.5 text-xs font-bold">نفد المخزون</span>}
          <button onClick={() => toggleWish(p.id)} className={`absolute bottom-3 left-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur transition ${wished ? 'bg-[#e94560] text-white' : 'bg-black/50 text-white hover:bg-black/70'}`} aria-label="المفضلة">
            <Heart className={`w-4 h-4 ${wished ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 text-sm font-bold min-h-10 transition group-hover:text-[#e9b44c]">{p.name}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-black text-[#e9b44c] tabular-nums">{fmt(p.price)}</span>
            <span className="text-xs text-gray-500">ج.م</span>
          </div>
          <button onClick={() => add(p)} disabled={out || !settings.isOpen} className="mt-3 w-full py-2.5 rounded-xl bg-white/5 text-white text-sm font-bold hover:bg-[#e9b44c] hover:text-[#0a0a0b] transition disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-white disabled:cursor-not-allowed">
            {out ? 'غير متاح' : 'أضف للسلة'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl">
      {/* ===== الهيدر ===== */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0b]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button onClick={() => setTab('home')} className="flex items-center gap-3 min-w-0">
            <Image src="/logo-header.png" alt="البدر" width={40} height={40} className="shrink-0" />
            <div className="min-w-0 text-right">
              <p className="font-bold text-sm truncate">{settings.storeName}</p>
              <p className="text-[11px] text-[#e9b44c] truncate">قهوة طازجة أونلاين</p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === key ? 'bg-white/10 text-[#e9b44c]' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            {waLink && <a href={waLink} target="_blank" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600/90 hover:bg-green-600 text-xs font-bold"><MessageCircle className="w-4 h-4" /> واتساب</a>}
            <button onClick={() => setDrawer('wish')} className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition" aria-label="المفضلة">
              <Heart className="w-5 h-5" />{wish.length > 0 && <Badge>{wish.length}</Badge>}
            </button>
            <button onClick={() => setDrawer('cart')} className="relative p-2.5 rounded-xl bg-[#e9b44c] text-[#0a0a0b] hover:bg-[#d4a13f] transition" aria-label="السلة">
              <ShoppingBag className="w-5 h-5" />{count > 0 && <Badge dark>{count}</Badge>}
            </button>
          </div>
        </div>
        {/* تابات الموبايل */}
        <nav className="md:hidden flex items-center gap-1 px-3 pb-2">
          {NAV.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${tab === key ? 'bg-white/10 text-[#e9b44c]' : 'text-gray-400'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      {/* ===== تاب الرئيسية ===== */}
      {tab === 'home' && (
        <>
          <HeroCarousel slides={slides} settings={settings} onCta={() => goProducts()} />

          {/* مميزات */}
          <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { Icon: Coffee, t: 'قهوة طازجة', s: 'تتحمّص وتُطحن حسب طلبك' },
              { Icon: Truck, t: 'توصيل سريع', s: 'لحد باب البيت' },
              { Icon: ShieldCheck, t: 'جودة مضمونة', s: 'أجود أنواع البن' },
              { Icon: Clock, t: 'دفع عند الاستلام', s: 'اطلب وادفع باستلامك' },
            ].map((f) => (
              <div key={f.t} className="bg-[#141416] border border-white/10 rounded-2xl p-4 text-center">
                <div className="w-11 h-11 rounded-xl bg-[#e9b44c]/10 flex items-center justify-center mx-auto mb-2"><f.Icon className="w-5 h-5 text-[#e9b44c]" /></div>
                <p className="font-bold text-sm">{f.t}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{f.s}</p>
              </div>
            ))}
          </div>

          {/* الفئات */}
          {categories.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 py-4">
              <SectionTitle title="تسوّق حسب الفئة" onMore={() => goProducts()} />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((c) => (
                  <button key={c.id} onClick={() => goProducts(c.id)} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1b1b1e] to-[#0a0a0b] p-6 text-right hover:border-[#e9b44c]/40 transition">
                    <Coffee className="w-8 h-8 text-[#e9b44c]/70 mb-2" />
                    <p className="font-bold group-hover:text-[#e9b44c] transition">{c.name}</p>
                    <ChevronLeft className="absolute bottom-4 left-4 w-5 h-5 text-gray-600 group-hover:text-[#e9b44c] transition" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* الأكثر رواجًا */}
          <div className="max-w-6xl mx-auto px-4 py-4 pb-12">
            <SectionTitle title="منتجاتنا المميّزة" onMore={() => goProducts()} />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {featured.map(cardOf)}
            </div>
          </div>
        </>
      )}

      {/* ===== تاب المنتجات ===== */}
      {tab === 'products' && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="relative mb-5 max-w-lg mx-auto">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="دوّر على قهوتك المفضلة..." className="w-full pr-12 pl-4 py-3.5 rounded-2xl border border-white/10 bg-[#141416] focus:outline-none focus:border-[#e9b44c]/60 text-sm placeholder:text-gray-500" />
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              <Chip active={!cat} onClick={() => setCat('')}>الكل</Chip>
              {categories.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id === cat ? '' : c.id)}>{c.name}</Chip>)}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(cardOf)}
          </div>
          {filtered.length === 0 && <p className="text-center text-gray-500 py-20">مفيش منتجات مطابقة.</p>}
        </div>
      )}

      {/* ===== تاب اتصل بنا ===== */}
      {tab === 'contact' && (
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h2 className="text-3xl font-black text-center mb-2">اتصل بنا</h2>
          <p className="text-gray-400 text-center mb-8">احنا في خدمتك — تواصل معانا بأي طريقة</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {settings.phone && (
              <a href={`tel:${settings.phone}`} className="bg-[#141416] border border-white/10 rounded-2xl p-6 text-center hover:border-[#e9b44c]/40 transition">
                <Phone className="w-7 h-7 text-[#e9b44c] mx-auto mb-2" />
                <p className="font-bold text-sm">اتصل بنا</p>
                <p className="text-xs text-gray-400 mt-1 tabular-nums" dir="ltr">{settings.phone}</p>
              </a>
            )}
            {waLink && (
              <a href={waLink} target="_blank" className="bg-[#141416] border border-white/10 rounded-2xl p-6 text-center hover:border-green-500/40 transition">
                <MessageCircle className="w-7 h-7 text-green-500 mx-auto mb-2" />
                <p className="font-bold text-sm">واتساب</p>
                <p className="text-xs text-gray-400 mt-1">راسلنا في أي وقت</p>
              </a>
            )}
            {settings.address && (
              <div className="bg-[#141416] border border-white/10 rounded-2xl p-6 text-center">
                <MapPin className="w-7 h-7 text-[#e94560] mx-auto mb-2" />
                <p className="font-bold text-sm">العنوان</p>
                <p className="text-xs text-gray-400 mt-1">{settings.address}</p>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-[#1b1b1e] to-[#0a0a0b] border border-white/10 rounded-2xl p-8 text-center">
            <Coffee className="w-10 h-10 text-[#e9b44c] mx-auto mb-3" />
            <h3 className="text-xl font-black">{settings.storeName}</h3>
            <p className="text-[#e9b44c] mt-1">{settings.tagline}</p>
            <button onClick={() => goProducts()} className="mt-5 px-8 py-3 rounded-2xl bg-[#e9b44c] text-[#0a0a0b] font-black hover:bg-[#d4a13f]">تصفّح المنتجات</button>
          </div>
        </div>
      )}

      {/* ===== الفوتر ===== */}
      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <p>© {settings.storeName}</p>
          <div className="flex items-center gap-4">
            {settings.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {settings.phone}</span>}
            {settings.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {settings.address}</span>}
          </div>
        </div>
      </footer>

      {/* ===== درج السلة / المفضلة ===== */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(null)} />
          <div className="relative bg-[#0f0f11] w-full max-w-md h-full flex flex-col shadow-2xl border-l border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {drawer === 'cart' ? <><ShoppingBag className="w-5 h-5 text-[#e9b44c]" /> سلة الطلب</> : <><Heart className="w-5 h-5 text-[#e94560]" /> المفضلة</>}
              </h3>
              <button onClick={() => setDrawer(null)} className="text-gray-400 hover:text-white" aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>

            {drawer === 'wish' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {wishProducts.length === 0 && <p className="text-gray-500 text-center py-10">قايمة المفضلة فاضية</p>}
                {wishProducts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <Thumb url={p.imageUrl} />
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{p.name}</p><p className="text-[#e9b44c] font-bold text-sm tabular-nums">{fmt(p.price)} ج.م</p></div>
                    <button onClick={() => add(p)} disabled={p.stock <= 0} className="px-3 py-1.5 rounded-lg bg-[#e9b44c] text-[#0a0a0b] text-xs font-bold hover:bg-[#d4a13f] disabled:opacity-30">أضف</button>
                    <button onClick={() => toggleWish(p.id)} className="text-gray-500 hover:text-red-400" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}

            {drawer === 'cart' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.length === 0 && <p className="text-gray-500 text-center py-10">السلة فاضية</p>}
                  {cart.map((c) => (
                    <div key={c.productId} className="flex items-center gap-3 border-b border-white/5 pb-3">
                      <Thumb url={c.imageUrl} />
                      <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{c.name}</p><p className="text-[#e9b44c] font-bold text-sm tabular-nums">{fmt(c.price)} ج.م</p></div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(c.productId, -1)} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-6 text-center font-bold text-sm tabular-nums">{c.quantity}</span>
                        <button onClick={() => changeQty(c.productId, 1)} disabled={c.quantity >= c.stock} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-30"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                      <button onClick={() => removeCart(c.productId)} className="text-gray-500 hover:text-red-400" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div className="border-t border-white/10 p-4 space-y-2.5">
                    <Row label="الإجمالي" value={`${fmt(subtotal)} ج.م`} />
                    <Row label="التوصيل" value={`${fmt(settings.deliveryFee)} ج.م`} />
                    <div className="flex justify-between font-black text-lg border-t border-white/10 pt-2"><span>المجموع</span><span className="tabular-nums text-[#e9b44c]">{fmt(total)} ج.م</span></div>
                    <button onClick={() => { setDrawer(null); setCheckout(true) }} className="w-full py-3.5 rounded-2xl bg-[#e9b44c] text-[#0a0a0b] font-black hover:bg-[#d4a13f] flex items-center justify-center gap-2">
                      إتمام الطلب <ChevronLeft className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== إتمام الطلب ===== */}
      {checkout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCheckout(false)} />
          <div className="relative bg-[#141416] border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-3.5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">بيانات التوصيل</h3><button onClick={() => setCheckout(false)} className="text-gray-400 hover:text-white" aria-label="إغلاق"><X className="w-5 h-5" /></button></div>
            {error && <div className="bg-red-500/15 text-red-300 p-3 rounded-xl text-sm">{error}</div>}
            <Field placeholder="الاسم" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} />
            <Field placeholder="رقم التليفون" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <textarea placeholder="العنوان بالتفصيل" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full px-4 py-3 border border-white/10 bg-[#0f0f11] rounded-xl focus:outline-none focus:border-[#e9b44c]/60 text-sm resize-none placeholder:text-gray-500" />
            <Field placeholder="ملاحظات (اختياري)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
            <div className="bg-[#e9b44c]/10 text-[#e9b44c] p-3 rounded-xl text-sm text-center font-bold">💵 الدفع عند الاستلام</div>
            <div className="flex justify-between font-black text-lg"><span>المجموع</span><span className="tabular-nums text-[#e9b44c]">{fmt(total)} ج.م</span></div>
            <button onClick={submit} disabled={loading} className="w-full py-3.5 rounded-2xl bg-[#e9b44c] text-[#0a0a0b] font-black hover:bg-[#d4a13f] disabled:opacity-50">{loading ? 'جاري الإرسال...' : 'تأكيد الطلب'}</button>
          </div>
        </div>
      )}

      {/* ===== نجاح ===== */}
      {done && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-[#141416] border border-white/10 rounded-3xl w-full max-w-sm p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto"><CheckCircle2 className="w-9 h-9 text-green-400" /></div>
            <h3 className="font-black text-xl">تم استلام طلبك!</h3>
            <p className="text-gray-400 text-sm">رقم الطلب: <span className="font-bold tabular-nums text-white">{done}</span></p>
            <p className="text-gray-400 text-sm">هنتواصل معاك على التليفون لتأكيد الطلب والتوصيل.</p>
            <button onClick={() => setDone(null)} className="w-full py-3 rounded-2xl bg-white/10 font-bold hover:bg-white/15">تمام</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ===== بانر السلايدر ===== */
function HeroCarousel({ slides, settings, onCta }: { slides: Slide[]; settings: Settings; onCta: () => void }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length

  useEffect(() => {
    if (n <= 1 || paused) return
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000)
    return () => clearInterval(t)
  }, [n, paused])

  // مفيش شرائح — بانر افتراضي
  if (n === 0) {
    return (
      <section className="relative overflow-hidden border-b border-white/5" style={{ backgroundColor: '#0a0d0b', backgroundImage: 'radial-gradient(90% 120% at 75% 20%, rgba(233,180,76,0.18), transparent 50%), radial-gradient(70% 90% at 15% 80%, rgba(233,69,96,0.12), transparent 55%), linear-gradient(180deg, #14100b 0%, #0a0a0b 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 py-20 text-center relative">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 mb-5" style={{ boxShadow: '0 0 60px -12px rgba(233,180,76,0.5)' }}><Coffee className="w-10 h-10 text-[#e9b44c]" /></div>
          <h1 className="text-4xl md:text-6xl font-black mb-3">{settings.storeName}</h1>
          <p className="text-[#e9b44c] text-lg md:text-2xl font-semibold">{settings.tagline}</p>
          <button onClick={onCta} className="mt-7 px-8 py-3.5 rounded-2xl bg-[#e9b44c] text-[#0a0a0b] font-black hover:bg-[#d4a13f]" style={{ boxShadow: '0 0 40px -8px rgba(233,180,76,0.45)' }}>تسوّق دلوقتي</button>
        </div>
      </section>
    )
  }

  const go = (idx: number) => setI(((idx % n) + n) % n)

  return (
    <section className="relative h-[62vh] max-h-[600px] min-h-[380px] overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} dir="rtl">
      {slides.map((s, idx) => (
        <div key={s.id} className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={idx !== i}>
          {s.type === 'VIDEO' ? (
            <video src={s.media} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.media} alt={s.title1 ?? 'بانر'} className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/85 via-black/55 to-black/20" />
          <div className="relative mx-auto flex h-full max-w-6xl flex-col items-start justify-center px-4">
            {s.badge && <span className="mb-5 rounded-full bg-[#e9b44c] px-4 py-1.5 text-xs font-black text-[#0a0a0b]">{s.badge}</span>}
            {(s.title1 || s.title2) && (
              <h1 className="max-w-2xl text-4xl font-black leading-[1.15] sm:text-6xl lg:text-7xl text-white">
                {s.title1}
                {s.title2 && <><br /><span className="text-[#e9b44c]">{s.title2}</span></>}
              </h1>
            )}
            {s.subtitle && <p className="mt-5 max-w-xl text-base opacity-90 sm:text-lg text-white">{s.subtitle}</p>}
            {s.ctaText && (
              <button onClick={onCta} className="mt-7 rounded-xl bg-[#e9b44c] px-8 py-3.5 font-black text-[#0a0a0b] transition hover:bg-[#d4a13f]" style={{ boxShadow: '0 0 40px -8px rgba(233,180,76,0.45)' }}>{s.ctaText}</button>
            )}
          </div>
        </div>
      ))}

      {n > 1 && (
        <>
          <button onClick={() => go(i - 1)} aria-label="السابق" className="absolute top-1/2 right-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-[#e9b44c] hover:text-[#0a0a0b]"><ChevronRight className="w-6 h-6" /></button>
          <button onClick={() => go(i + 1)} aria-label="التالي" className="absolute top-1/2 left-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-[#e9b44c] hover:text-[#0a0a0b]"><ChevronLeft className="w-6 h-6" /></button>
          <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2">
            {slides.map((s, idx) => (
              <button key={s.id} onClick={() => go(idx)} aria-label={`شريحة ${idx + 1}`} className={`h-2 rounded-full transition-all ${idx === i ? 'w-8 bg-[#e9b44c]' : 'w-2 bg-white/50 hover:bg-white'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/* ===== عناصر مساعدة ===== */
function SectionTitle({ title, onMore }: { title: string; onMore: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-black flex items-center gap-2"><span className="w-1.5 h-6 rounded bg-[#e9b44c]" />{title}</h2>
      <button onClick={onMore} className="text-sm text-[#e9b44c] font-bold flex items-center gap-1 hover:gap-2 transition-all">عرض الكل <ChevronLeft className="w-4 h-4" /></button>
    </div>
  )
}
function Badge({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <span className={`absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-black flex items-center justify-center tabular-nums ${dark ? 'bg-[#0a0a0b] text-[#e9b44c]' : 'bg-[#e94560] text-white'}`}>{children}</span>
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-4 py-2 rounded-full text-sm font-bold transition ${active ? 'bg-[#e9b44c] text-[#0a0a0b]' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>{children}</button>
}
function Thumb({ url }: { url: string | null }) {
  return <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">{url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="w-full h-full object-cover" />) : <Coffee className="w-6 h-6 text-white/20" />}</div>
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-sm"><span className="text-gray-400">{label}</span><span className="tabular-nums">{value}</span></div>
}
function Field({ placeholder, value, onChange, type = 'text' }: { placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 border border-white/10 bg-[#0f0f11] rounded-xl focus:outline-none focus:border-[#e9b44c]/60 text-sm placeholder:text-gray-500" />
}
