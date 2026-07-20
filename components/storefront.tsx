'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Coffee, ShoppingBag, Heart, Plus, Minus, Trash2, X, Search, Phone, MessageCircle,
  CheckCircle2, MapPin, ChevronLeft, ChevronRight, Home, Grid3x3, Clock, Truck, ShieldCheck,
  Sparkles, Flame, SlidersHorizontal, Star, Mail, Banknote,
} from 'lucide-react'

const FacebookIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
)
const InstagramIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
)
import { AlBadrLogo } from '@/components/albadr-logo'

interface StoreProduct { id: string; name: string; unit: string; price: number; oldPrice: number | null; stock: number; categoryId: string | null; imageUrl: string | null; isNew: boolean; bestRank: number | null }
interface Category { id: string; name: string }
interface Slide { id: string; type: string; media: string; badge: string | null; title1: string | null; title2: string | null; subtitle: string | null; ctaText: string | null; ctaLink: string | null }
interface Settings {
  storeName: string; tagline: string; heroImage: string | null; phone: string | null; whatsapp: string | null; address: string | null
  deliveryFee: number; minOrder: number; isOpen: boolean; showOutOfStock: boolean; accentColor: string; light: boolean
  promoText: string | null; promoLink: string | null; aboutTitle: string | null; aboutText: string | null
  facebook: string | null; instagram: string | null; email: string | null
  heroInterval: number; heroMotion: string; codEnabled: boolean; cardEnabled: boolean
}
interface Block { id: string; kind: string; title: string; subtitle: string | null; imageUrl: string | null; link: string | null; rating: number }
interface CartLine { productId: string; name: string; price: number; unit: string; quantity: number; stock: number; imageUrl: string | null }

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const CART_KEY = 'albadr-cart'
const WISH_KEY = 'albadr-wishlist'

export function Storefront({ settings, products, categories, slides, blocks = [] }: { settings: Settings; products: StoreProduct[]; categories: Category[]; slides: Slide[]; blocks?: Block[] }) {
  const light = settings.light
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
  const [toast, setToast] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<string>(settings.codEnabled ? 'الدفع عند الاستلام' : 'فيزا')

  useEffect(() => {
    try {
      const c = localStorage.getItem(CART_KEY); if (c) setCart(JSON.parse(c))
      const w = localStorage.getItem(WISH_KEY); if (w) setWish(JSON.parse(w))
    } catch {}
  }, [])
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem(WISH_KEY, JSON.stringify(wish)) }, [wish])

  // تأثير الظهور عند التمرير
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('reveal-in'); io.unobserve(e.target) } })
    }, { threshold: 0.12 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [tab])

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const filtered = useMemo(() => products.filter((p) => p.name.includes(search.trim()) && (!cat || p.categoryId === cat)), [products, search, cat])
  const newest = useMemo(() => products.slice(0, 10), [products])
  const bestSellers = useMemo(() => products.filter((p) => p.bestRank !== null).sort((a, b) => (a.bestRank! - b.bestRank!)).slice(0, 8), [products])
  const featured = useMemo(() => (bestSellers.length >= 4 ? bestSellers : products.slice(0, 8)), [bestSellers, products])

  // بلوكات المحتوى الديناميكي (زي بن نجار)
  const roastCards = blocks.filter((b) => b.kind === 'ROAST_CARD')
  const brandCards = blocks.filter((b) => b.kind === 'BRAND_CARD')
  const loyaltySteps = blocks.filter((b) => b.kind === 'LOYALTY_STEP')
  const reviews = blocks.filter((b) => b.kind === 'REVIEW')
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  const add = (p: StoreProduct) => {
    if (p.stock <= 0) return
    setCart((prev) => {
      const ex = prev.find((c) => c.productId === p.id)
      if (ex) { if (ex.quantity >= p.stock) return prev; return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c)) }
      return [...prev, { productId: p.id, name: p.name, price: p.price, unit: p.unit, quantity: 1, stock: p.stock, imageUrl: p.imageUrl }]
    })
    // إشعار خفيف بدل ما نفتح السلة
    setToast(`✓ ${p.name} اتضاف للسلة`)
    setTimeout(() => setToast(null), 1800)
  }
  const changeQty = (id: string, d: number) => setCart((prev) => prev.map((c) => (c.productId === id ? { ...c, quantity: Math.min(c.stock, Math.max(0, c.quantity + d)) } : c)).filter((c) => c.quantity > 0))
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
    const res = await fetch('/api/store/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, paymentMethod: payMethod, items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })) }) })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'فشل الطلب'); return }
    setDone(data.orderNo); setCart([]); setCheckout(false); setDrawer(null)
  }

  const waLink = settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}` : null
  const NAV = [
    { key: 'home', label: 'الرئيسية', Icon: Home },
    { key: 'products', label: 'المنتجات', Icon: Grid3x3 },
    { key: 'contact', label: 'اتصل بنا', Icon: Phone },
  ] as const

  // ألوان الثيم
  const panel = light ? 'bg-white border-black/10' : 'bg-[#141416] border-white/10'
  const panelSoft = light ? 'bg-black/5' : 'bg-white/5'
  const sub = light ? 'text-gray-500' : 'text-gray-400'
  const headerBg = light ? 'bg-[#f5f1ea]/90 border-black/10' : 'bg-[#0a0a0b]/90 border-white/10'

  // كارت منتج احترافي — شغّال مع أي صورة، مرتفع وأنيق
  const card = (p: StoreProduct, compact = false) => {
    const out = p.stock <= 0
    const wished = wish.includes(p.id)
    const off = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0
    return (
      <div
        key={p.id}
        className={`group relative flex flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1.5 ${
          light ? 'bg-white shadow-sm hover:shadow-xl' : 'bg-[#141416] ring-1 ring-white/10 hover:ring-acc-40 hover:shadow-2xl'
        } ${compact ? 'w-44 shrink-0' : ''}`}
      >
        {/* منطقة الصورة */}
        <div className={`relative aspect-square flex items-center justify-center overflow-hidden ${light ? 'bg-gradient-to-b from-black/[0.04] to-transparent' : 'bg-gradient-to-b from-white/[0.05] to-transparent'}`}>
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={p.name}
              className={`h-full w-full object-contain p-4 transition-transform duration-300 ease-out group-hover:scale-[1.07] ${out ? 'opacity-40 grayscale' : ''}`}
              loading="lazy"
            />
          ) : (
            <Coffee className="w-16 h-16 opacity-15 transition-transform duration-300 group-hover:scale-110" />
          )}

          {/* شارات */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
            {off > 0 && <span className="rounded-lg bg-[#e94560] px-2 py-1 text-[11px] font-black text-white shadow-sm">خصم {off}%</span>}
            {p.isNew && off === 0 && <span className="rounded-lg bg-acc px-2 py-1 text-[11px] font-black text-black shadow-sm">جديد</span>}
            {p.bestRank !== null && p.bestRank < 5 && (
              <span className={`rounded-lg px-2 py-1 text-[10px] font-black flex items-center gap-1 shadow-sm ${light ? 'bg-[#1a1a2e] text-white' : 'bg-white text-[#1a1a2e]'}`}>
                <Flame className="w-3 h-3 text-[#e94560]" /> الأكثر مبيعًا
              </span>
            )}
          </div>
          {out && (
            <span className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-sm py-1.5 text-center text-xs font-black text-white">
              نفدت الكمية
            </span>
          )}

          {/* المفضلة */}
          <button
            onClick={() => toggleWish(p.id)}
            className={`absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
              wished
                ? 'bg-[#e94560] text-white scale-105'
                : light
                  ? 'bg-white/90 text-gray-400 shadow-sm hover:text-[#e94560] hover:scale-105'
                  : 'bg-black/40 text-white/70 backdrop-blur hover:text-[#e94560] hover:scale-105'
            }`}
            aria-label="المفضلة"
          >
            <Heart className={`w-4 h-4 ${wished ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* التفاصيل */}
        <div className="flex flex-1 flex-col p-3.5 pt-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${light ? 'bg-black/5 text-gray-500' : 'bg-white/5 text-gray-400'}`}>{p.unit}</span>
            {off > 0 && <span className={`text-[11px] line-through ${sub} tabular-nums`}>{fmt(p.oldPrice!)}</span>}
          </div>
          <h3 className="line-clamp-2 text-sm font-bold leading-snug min-h-10 transition-colors group-hover:text-acc">{p.name}</h3>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-lg font-black text-acc tabular-nums">{fmt(p.price)}</span>
            <span className={`text-[11px] ${sub}`}>ج.م</span>
          </div>
          <button
            onClick={() => add(p)}
            disabled={out || !settings.isOpen}
            className="mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-acc text-black text-sm font-black transition-all duration-200 hover:brightness-95 active:scale-[0.98] disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ShoppingBag className="w-4 h-4" />
            {out ? 'غير متاح' : 'أضف للسلة'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ ['--acc' as any]: settings.accentColor }}>
      <AccentStyles />

      {/* الهيدر */}
      <header className={`sticky top-0 z-40 border-b ${headerBg} backdrop-blur`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button onClick={() => setTab('home')} className="flex items-center gap-2.5 min-w-0">
            <AlBadrLogo className="w-11 h-11 shrink-0 text-acc" />
            <div className="min-w-0 text-right">
              <p className="font-black text-sm truncate">{settings.storeName}</p>
              <p className="text-[11px] text-acc truncate">قهوة طازجة أونلاين</p>
            </div>
          </button>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === key ? `${panelSoft} text-acc` : `${sub} hover:${panelSoft}`}`}>{label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            {waLink && <a href={waLink} target="_blank" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600/90 hover:bg-green-600 text-white text-xs font-bold"><MessageCircle className="w-4 h-4" /> واتساب</a>}
            <button onClick={() => setDrawer('wish')} className={`relative p-2.5 rounded-xl ${panelSoft} transition`} aria-label="المفضلة"><Heart className="w-5 h-5" />{wish.length > 0 && <Badge>{wish.length}</Badge>}</button>
            <button onClick={() => setDrawer('cart')} className="relative p-2.5 rounded-xl bg-acc text-black transition" aria-label="السلة"><ShoppingBag className="w-5 h-5" />{count > 0 && <Badge dark>{count}</Badge>}</button>
          </div>
        </div>
        <nav className="md:hidden flex items-center gap-1 px-3 pb-2">
          {NAV.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${tab === key ? `${panelSoft} text-acc` : sub}`}><Icon className="w-4 h-4" /> {label}</button>
          ))}
        </nav>
      </header>

      {/* ===== الرئيسية (هيكل بن نجار) ===== */}
      {tab === 'home' && (
        <>
          {/* 1) البانر الرئيسي */}
          <HeroCarousel slides={slides} settings={settings} onCta={() => goProducts()} light={light} />

          {/* 2) كروت التحميص/الاختيار */}
          {roastCards.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 pt-10" data-reveal>
              <h2 className="text-2xl font-black text-center mb-1">اختار تحميصك</h2>
              <p className={`${sub} text-center text-sm mb-6`}>كل درجة تحميص ليها طعمها الخاص</p>
              <div className={`grid gap-4 ${roastCards.length >= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {roastCards.map((b) => (
                  <button key={b.id} onClick={() => goProducts()} className={`group relative overflow-hidden rounded-3xl border ${panel} p-6 text-center hover:border-acc-40 hover:-translate-y-1 transition`}>
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.imageUrl} alt={b.title} className="w-20 h-20 object-cover rounded-2xl mx-auto mb-3" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-acc-10 flex items-center justify-center mx-auto mb-3"><Flame className="w-8 h-8 text-acc" /></div>
                    )}
                    <p className="text-lg font-black group-hover:text-acc transition">{b.title}</p>
                    {b.subtitle && <p className={`text-xs ${sub} mt-1.5 leading-relaxed`}>{b.subtitle}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3) شريط العرض الترويجي */}
          {settings.promoText && (
            <div className="max-w-6xl mx-auto px-4 pt-8" data-reveal>
              <button onClick={() => goProducts()} className="w-full rounded-2xl bg-acc text-black px-6 py-4 text-center font-black text-sm sm:text-base glow-acc hover:brightness-95 transition">
                🎁 {settings.promoText}
              </button>
            </div>
          )}

          {/* 4) أحدث المنتجات */}
          {newest.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 pt-10" data-reveal>
              <SectionTitle title="أحدث المنتجات" icon={<Sparkles className="w-5 h-5 text-acc" />} onMore={() => goProducts()} />
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                {newest.map((p) => <div key={p.id} className="snap-start">{card(p, true)}</div>)}
              </div>
            </div>
          )}

          {/* 5) الأكثر مبيعًا */}
          {bestSellers.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 pt-8" data-reveal>
              <SectionTitle title="الأكثر مبيعًا" icon={<Flame className="w-5 h-5 text-[#e94560]" />} onMore={() => goProducts()} />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{bestSellers.map((p) => card(p))}</div>
            </div>
          )}

          {/* 6) خطوط المنتجات (كروت العلامة) */}
          {(brandCards.length > 0 ? brandCards : null) && (
            <div className="max-w-6xl mx-auto px-4 pt-10" data-reveal>
              <h2 className="text-2xl font-black text-center mb-6">خطوط منتجاتنا</h2>
              <div className={`grid gap-4 ${brandCards.length >= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {brandCards.map((b) => (
                  <button key={b.id} onClick={() => goProducts(b.link || undefined)} className={`group relative overflow-hidden rounded-3xl border ${panel} text-right hover:border-acc-40 hover:-translate-y-1 transition`}>
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.imageUrl} alt={b.title} className="w-full h-40 object-cover" />
                    ) : (
                      <div className={`w-full h-40 flex items-center justify-center ${light ? 'bg-black/5' : 'bg-gradient-to-br from-[#1b1b1e] to-[#0a0a0b]'}`}><Coffee className="w-14 h-14 text-acc opacity-60" /></div>
                    )}
                    <div className="p-5">
                      <p className="text-lg font-black group-hover:text-acc transition">{b.title}</p>
                      {b.subtitle && <p className={`text-xs ${sub} mt-1`}>{b.subtitle}</p>}
                      <span className="mt-3 inline-flex items-center gap-1 text-sm text-acc font-bold">تسوّق الآن <ChevronLeft className="w-4 h-4" /></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* الفئات */}
          {categories.length > 0 && brandCards.length === 0 && (
            <div className="max-w-6xl mx-auto px-4 pt-10" data-reveal>
              <SectionTitle title="تسوّق حسب الفئة" icon={<Grid3x3 className="w-5 h-5 text-acc" />} onMore={() => goProducts()} />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((c) => (
                  <button key={c.id} onClick={() => goProducts(c.id)} className={`group relative overflow-hidden rounded-2xl border ${panel} p-6 text-right hover:border-acc-40 transition`}>
                    <Coffee className="w-8 h-8 text-acc mb-2 opacity-80" />
                    <p className="font-bold group-hover:text-acc transition">{c.name}</p>
                    <ChevronLeft className={`absolute bottom-4 left-4 w-5 h-5 ${sub} group-hover:text-acc transition`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 7) قصة العلامة */}
          {(settings.aboutTitle || settings.aboutText) && (
            <div className="max-w-6xl mx-auto px-4 pt-12" data-reveal>
              <div className={`rounded-3xl border ${panel} p-8 sm:p-12 text-center relative overflow-hidden`}>
                <div className="absolute inset-0 opacity-[0.04] flex items-center justify-center pointer-events-none"><AlBadrLogo className="w-96 h-96" /></div>
                <div className="relative">
                  <AlBadrLogo className="w-16 h-16 text-acc mx-auto mb-4" />
                  {settings.aboutTitle && <h2 className="text-2xl sm:text-3xl font-black leading-snug max-w-2xl mx-auto">{settings.aboutTitle}</h2>}
                  {settings.aboutText && <p className={`${sub} mt-4 max-w-xl mx-auto leading-relaxed`}>{settings.aboutText}</p>}
                </div>
              </div>
            </div>
          )}

          {/* 8) خطوات الولاء */}
          {loyaltySteps.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 pt-12" data-reveal>
              <h2 className="text-2xl font-black text-center mb-6">اطلب من البدر… واكسب مع كل فنجان</h2>
              <div className={`grid gap-4 ${loyaltySteps.length >= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {loyaltySteps.map((b, i) => (
                  <div key={b.id} className={`rounded-3xl border ${panel} p-6 text-center relative`}>
                    <span className="absolute top-4 right-4 w-8 h-8 rounded-full bg-acc text-black font-black text-sm flex items-center justify-center tabular-nums">{i + 1}</span>
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.imageUrl} alt={b.title} className="w-16 h-16 object-cover rounded-2xl mx-auto mb-3" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-acc-10 flex items-center justify-center mx-auto mb-3"><Coffee className="w-7 h-7 text-acc" /></div>
                    )}
                    <p className="font-black">{b.title}</p>
                    {b.subtitle && <p className={`text-xs ${sub} mt-1.5`}>{b.subtitle}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9) آراء العملاء */}
          {reviews.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 pt-12" data-reveal>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black">آراء عملائنا</h2>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-5 h-5 ${i < Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : light ? 'text-gray-300' : 'text-gray-600'}`} />)}
                  </div>
                  <span className={`text-sm ${sub} tabular-nums`}>{avgRating.toFixed(1)} من {reviews.length} تقييم</span>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                {reviews.map((r) => (
                  <div key={r.id} className={`snap-start w-72 shrink-0 rounded-3xl border ${panel} p-5`}>
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'text-yellow-400 fill-yellow-400' : light ? 'text-gray-300' : 'text-gray-600'}`} />)}
                    </div>
                    {r.subtitle && <p className="text-sm leading-relaxed line-clamp-4">&ldquo;{r.subtitle}&rdquo;</p>}
                    <p className="mt-3 font-bold text-sm text-acc">{r.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* مميزات ثابتة */}
          <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-3" data-reveal>
            {[
              { Icon: Coffee, t: 'قهوة طازجة', s: 'تتحمّص وتُطحن حسب طلبك' },
              { Icon: Truck, t: 'توصيل سريع', s: 'لحد باب البيت' },
              { Icon: ShieldCheck, t: 'جودة مضمونة', s: 'أجود أنواع البن' },
              { Icon: Clock, t: 'دفع عند الاستلام', s: 'اطلب وادفع باستلامك' },
            ].map((f) => (
              <div key={f.t} className={`rounded-2xl border ${panel} p-4 text-center`}>
                <div className="w-11 h-11 rounded-xl bg-acc-10 flex items-center justify-center mx-auto mb-2"><f.Icon className="w-5 h-5 text-acc" /></div>
                <p className="font-bold text-sm">{f.t}</p>
                <p className={`text-[11px] ${sub} mt-0.5`}>{f.s}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== المنتجات — فلتر جانبي ===== */}
      {tab === 'products' && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="relative mb-6 max-w-lg mx-auto">
            <Search className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${sub}`} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="دوّر على قهوتك المفضلة..." className={`w-full pr-12 pl-4 py-3.5 rounded-2xl border ${panel} focus:outline-none focus:border-acc-40 text-sm`} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
            {/* فلتر التصنيفات */}
            <aside className={`rounded-2xl border ${panel} p-4 h-fit lg:sticky lg:top-24`}>
              <p className="flex items-center gap-2 font-bold text-sm mb-3"><SlidersHorizontal className="w-4 h-4 text-acc" /> التصنيفات</p>
              <div className="space-y-1">
                <FilterItem active={!cat} onClick={() => setCat('')} light={light}>كل المنتجات ({products.length})</FilterItem>
                {categories.map((c) => {
                  const n = products.filter((p) => p.categoryId === c.id).length
                  return <FilterItem key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} light={light}>{c.name} ({n})</FilterItem>
                })}
              </div>
            </aside>
            {/* الشبكة */}
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{filtered.map((p) => card(p))}</div>
              {filtered.length === 0 && <p className={`text-center ${sub} py-20`}>مفيش منتجات مطابقة.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ===== اتصل بنا ===== */}
      {tab === 'contact' && (
        <div className="max-w-3xl mx-auto px-4 py-12" data-reveal>
          <div className="flex justify-center mb-4"><AlBadrLogo className="w-24 h-24 text-acc" /></div>
          <h2 className="text-3xl font-black text-center mb-2">اتصل بنا</h2>
          <p className={`${sub} text-center mb-8`}>احنا في خدمتك — تواصل معانا بأي طريقة</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {settings.phone && <a href={`tel:${settings.phone}`} className={`rounded-2xl border ${panel} p-6 text-center hover:border-acc-40 transition`}><Phone className="w-7 h-7 text-acc mx-auto mb-2" /><p className="font-bold text-sm">اتصل بنا</p><p className={`text-xs ${sub} mt-1 tabular-nums`} dir="ltr">{settings.phone}</p></a>}
            {waLink && <a href={waLink} target="_blank" className={`rounded-2xl border ${panel} p-6 text-center hover:border-green-500/40 transition`}><MessageCircle className="w-7 h-7 text-green-500 mx-auto mb-2" /><p className="font-bold text-sm">واتساب</p><p className={`text-xs ${sub} mt-1`}>راسلنا في أي وقت</p></a>}
            {settings.address && <div className={`rounded-2xl border ${panel} p-6 text-center`}><MapPin className="w-7 h-7 text-[#e94560] mx-auto mb-2" /><p className="font-bold text-sm">العنوان</p><p className={`text-xs ${sub} mt-1`}>{settings.address}</p></div>}
          </div>
          <div className={`rounded-2xl border ${panel} p-8 text-center`}>
            <h3 className="text-xl font-black">{settings.storeName}</h3>
            <p className="text-acc mt-1">{settings.tagline}</p>
            <button onClick={() => goProducts()} className="mt-5 px-8 py-3 rounded-2xl bg-acc text-black font-black hover:bg-acc-dark">تصفّح المنتجات</button>
          </div>
        </div>
      )}

      {/* الفوتر (أعمدة زي بن نجار) */}
      <footer className={`border-t ${light ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.02]'}`}>
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* العلامة */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <AlBadrLogo className="w-14 h-14 text-acc" />
              <div>
                <p className="font-black">{settings.storeName}</p>
                <p className={`text-xs ${sub}`}>{settings.tagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              {settings.facebook && <a href={settings.facebook} target="_blank" aria-label="فيسبوك" className={`w-9 h-9 rounded-xl ${panelSoft} flex items-center justify-center hover:text-acc transition`}><FacebookIcon /></a>}
              {settings.instagram && <a href={settings.instagram} target="_blank" aria-label="انستجرام" className={`w-9 h-9 rounded-xl ${panelSoft} flex items-center justify-center hover:text-acc transition`}><InstagramIcon /></a>}
              {waLink && <a href={waLink} target="_blank" aria-label="واتساب" className={`w-9 h-9 rounded-xl ${panelSoft} flex items-center justify-center hover:text-green-500 transition`}><MessageCircle className="w-4 h-4" /></a>}
              {settings.email && <a href={`mailto:${settings.email}`} aria-label="إيميل" className={`w-9 h-9 rounded-xl ${panelSoft} flex items-center justify-center hover:text-acc transition`}><Mail className="w-4 h-4" /></a>}
            </div>
          </div>

          {/* روابط مهمة */}
          <div>
            <h4 className="font-black mb-3">روابط مهمة</h4>
            <ul className={`space-y-2 text-sm ${sub}`}>
              <li><button onClick={() => { setTab('home'); window.scrollTo({ top: 0 }) }} className="hover:text-acc transition">الرئيسية</button></li>
              <li><button onClick={() => goProducts()} className="hover:text-acc transition">كل المنتجات</button></li>
              <li><button onClick={() => { setTab('contact'); window.scrollTo({ top: 0 }) }} className="hover:text-acc transition">تواصل معنا</button></li>
            </ul>
          </div>

          {/* المنتجات (تصنيفات) */}
          <div>
            <h4 className="font-black mb-3">منتجاتنا</h4>
            <ul className={`space-y-2 text-sm ${sub}`}>
              {categories.slice(0, 5).map((c) => (
                <li key={c.id}><button onClick={() => goProducts(c.id)} className="hover:text-acc transition">{c.name}</button></li>
              ))}
              {categories.length === 0 && <li>—</li>}
            </ul>
          </div>

          {/* التواصل والدفع */}
          <div>
            <h4 className="font-black mb-3">تواصل ودفع</h4>
            <ul className={`space-y-2 text-sm ${sub}`}>
              {settings.phone && <li className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" /> <span dir="ltr" className="tabular-nums">{settings.phone}</span></li>}
              {settings.email && <li className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0" /> {settings.email}</li>}
              {settings.address && <li className="flex items-start gap-2"><MapPin className="w-4 h-4 shrink-0 mt-0.5" /> {settings.address}</li>}
              <li className="flex items-center gap-2 pt-1"><Banknote className="w-4 h-4 shrink-0 text-green-500" /> الدفع عند الاستلام</li>
            </ul>
          </div>
        </div>
        <div className={`border-t ${light ? 'border-black/10' : 'border-white/10'}`}>
          <p className={`max-w-6xl mx-auto px-4 py-4 text-center text-xs ${sub}`}>© {new Date().getFullYear()} {settings.storeName} — جميع الحقوق محفوظة</p>
        </div>
      </footer>

      {/* إشعار إضافة للسلة */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-acc text-black px-5 py-2.5 rounded-2xl text-sm font-black shadow-2xl toast-in" dir="rtl">
          {toast}
        </div>
      )}

      {/* زرار واتساب عائم */}
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          aria-label="تواصل واتساب"
          className="fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center shadow-2xl transition hover:scale-105"
          style={{ boxShadow: '0 8px 30px -6px rgba(22,163,74,0.6)' }}
        >
          <MessageCircle className="w-7 h-7" />
        </a>
      )}

      {/* درج السلة/المفضلة */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(null)} />
          <div className={`relative ${light ? 'bg-white' : 'bg-[#0f0f11]'} w-full max-w-md h-full flex flex-col shadow-2xl border-l ${light ? 'border-black/10' : 'border-white/10'}`}>
            <div className={`p-4 border-b ${light ? 'border-black/10' : 'border-white/10'} flex items-center justify-between`}>
              <h3 className="font-bold text-lg flex items-center gap-2">{drawer === 'cart' ? <><ShoppingBag className="w-5 h-5 text-acc" /> سلة الطلب</> : <><Heart className="w-5 h-5 text-[#e94560]" /> المفضلة</>}</h3>
              <button onClick={() => setDrawer(null)} className={sub} aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>
            {drawer === 'wish' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {wishProducts.length === 0 && <p className={`${sub} text-center py-10`}>قايمة المفضلة فاضية</p>}
                {wishProducts.map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 border-b ${light ? 'border-black/5' : 'border-white/5'} pb-3`}>
                    <Thumb url={p.imageUrl} light={light} />
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{p.name}</p><p className="text-acc font-bold text-sm tabular-nums">{fmt(p.price)} ج.م</p></div>
                    <button onClick={() => add(p)} disabled={p.stock <= 0} className="px-3 py-1.5 rounded-lg bg-acc text-black text-xs font-bold hover:bg-acc-dark disabled:opacity-30">أضف</button>
                    <button onClick={() => toggleWish(p.id)} className={`${sub} hover:text-red-400`} aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
            {drawer === 'cart' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.length === 0 && <p className={`${sub} text-center py-10`}>السلة فاضية</p>}
                  {cart.map((c) => (
                    <div key={c.productId} className={`flex items-center gap-3 border-b ${light ? 'border-black/5' : 'border-white/5'} pb-3`}>
                      <Thumb url={c.imageUrl} light={light} />
                      <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{c.name}</p><p className="text-acc font-bold text-sm tabular-nums">{fmt(c.price)} ج.م</p></div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(c.productId, -1)} className={`w-7 h-7 rounded-lg ${panelSoft} flex items-center justify-center`}><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-6 text-center font-bold text-sm tabular-nums">{c.quantity}</span>
                        <button onClick={() => changeQty(c.productId, 1)} disabled={c.quantity >= c.stock} className={`w-7 h-7 rounded-lg ${panelSoft} flex items-center justify-center disabled:opacity-30`}><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                      <button onClick={() => removeCart(c.productId)} className={`${sub} hover:text-red-400`} aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div className={`border-t ${light ? 'border-black/10' : 'border-white/10'} p-4 space-y-2.5`}>
                    <Row label="الإجمالي" value={`${fmt(subtotal)} ج.م`} sub={sub} />
                    <Row label="التوصيل" value={`${fmt(settings.deliveryFee)} ج.م`} sub={sub} />
                    <div className={`flex justify-between font-black text-lg border-t ${light ? 'border-black/10' : 'border-white/10'} pt-2`}><span>المجموع</span><span className="tabular-nums text-acc">{fmt(total)} ج.م</span></div>
                    <button onClick={() => { setDrawer(null); setCheckout(true) }} className="w-full py-3.5 rounded-2xl bg-acc text-black font-black hover:bg-acc-dark flex items-center justify-center gap-2">إتمام الطلب <ChevronLeft className="w-5 h-5" /></button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* إتمام الطلب */}
      {checkout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCheckout(false)} />
          <div className={`relative ${panel} border rounded-3xl w-full max-w-md p-6 space-y-3.5 max-h-[92vh] overflow-y-auto`}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">بيانات التوصيل</h3><button onClick={() => setCheckout(false)} className={sub} aria-label="إغلاق"><X className="w-5 h-5" /></button></div>
            {error && <div className="bg-red-500/15 text-red-500 p-3 rounded-xl text-sm">{error}</div>}
            <Field placeholder="الاسم" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} light={light} />
            <Field placeholder="رقم التليفون" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} light={light} />
            <textarea placeholder="العنوان بالتفصيل" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:border-acc-40 text-sm resize-none ${light ? 'bg-black/5 border-black/10' : 'bg-[#0f0f11] border-white/10'}`} />
            <Field placeholder="ملاحظات (اختياري)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} light={light} />

            {/* اختيار طريقة الدفع */}
            <div>
              <p className="text-sm font-bold mb-2">طريقة الدفع</p>
              <div className="grid grid-cols-1 gap-2">
                {settings.codEnabled && (
                  <button type="button" onClick={() => setPayMethod('الدفع عند الاستلام')} className={`flex items-center justify-between p-3.5 rounded-xl border text-sm font-bold transition ${payMethod === 'الدفع عند الاستلام' ? 'border-acc-40 bg-acc-10 text-acc' : light ? 'border-black/10' : 'border-white/10'}`}>
                    <span>💵 الدفع عند الاستلام</span>
                    {payMethod === 'الدفع عند الاستلام' && <CheckCircle2 className="w-5 h-5" />}
                  </button>
                )}
                {settings.cardEnabled && (
                  <button type="button" onClick={() => setPayMethod('فيزا')} className={`flex items-center justify-between p-3.5 rounded-xl border text-sm font-bold transition ${payMethod === 'فيزا' ? 'border-acc-40 bg-acc-10 text-acc' : light ? 'border-black/10' : 'border-white/10'}`}>
                    <span>💳 الدفع بالفيزا</span>
                    {payMethod === 'فيزا' && <CheckCircle2 className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-between font-black text-lg"><span>المجموع</span><span className="tabular-nums text-acc">{fmt(total)} ج.م</span></div>
            <button onClick={submit} disabled={loading} className="w-full py-3.5 rounded-2xl bg-acc text-black font-black hover:bg-acc-dark disabled:opacity-50">{loading ? 'جاري الإرسال...' : 'تأكيد الطلب'}</button>
          </div>
        </div>
      )}

      {/* نجاح */}
      {done && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/70" />
          <div className={`relative ${panel} border rounded-3xl w-full max-w-sm p-8 text-center space-y-4`}>
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto"><CheckCircle2 className="w-9 h-9 text-green-500" /></div>
            <h3 className="font-black text-xl">تم استلام طلبك!</h3>
            <p className={`${sub} text-sm`}>رقم الطلب: <span className="font-bold tabular-nums text-acc">{done}</span></p>
            <p className={`${sub} text-sm`}>هنتواصل معاك على التليفون لتأكيد الطلب والتوصيل.</p>
            <button onClick={() => setDone(null)} className={`w-full py-3 rounded-2xl ${panelSoft} font-bold`}>تمام</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ===== البانر السلايدر ===== */
function HeroCarousel({ slides, settings, onCta, light }: { slides: Slide[]; settings: Settings; onCta: () => void; light: boolean }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length
  const intervalSec = Math.max(2, Math.min(30, settings.heroInterval || 6))
  const slideMode = settings.heroMotion !== 'fade'
  useEffect(() => {
    if (n <= 1 || paused) return
    const t = setInterval(() => setI((x) => (x + 1) % n), intervalSec * 1000)
    return () => clearInterval(t)
  }, [n, paused, intervalSec])

  if (n === 0) {
    return (
      <section className="relative overflow-hidden" style={{ backgroundColor: light ? '#efe7db' : '#0a0d0b', backgroundImage: 'radial-gradient(90% 120% at 75% 20%, color-mix(in srgb, var(--acc) 22%, transparent), transparent 50%), radial-gradient(70% 90% at 15% 80%, rgba(233,69,96,0.12), transparent 55%)' }}>
        <div className="max-w-6xl mx-auto px-4 py-16 text-center relative">
          <div className="flex justify-center mb-4"><AlBadrLogo className="w-28 h-28 text-acc" /></div>
          <h1 className="text-4xl md:text-6xl font-black mb-3">{settings.storeName}</h1>
          <p className="text-acc text-lg md:text-2xl font-semibold">{settings.tagline}</p>
          <button onClick={onCta} className="mt-7 px-8 py-3.5 rounded-2xl bg-acc text-black font-black hover:bg-acc-dark glow-acc">تسوّق دلوقتي</button>
        </div>
      </section>
    )
  }
  const go = (idx: number) => setI(((idx % n) + n) % n)
  return (
    <section className="relative h-[60vh] max-h-[580px] min-h-[380px] overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} dir="rtl">
      {/* شريط الشرائح — انزلاق ناعم أو تلاشي حسب الإعدادات */}
      <div
        className={slideMode ? 'flex h-full' : 'relative h-full'}
        style={
          slideMode
            ? { width: `${n * 100}%`, transform: `translateX(${i * (100 / n)}%)`, transition: 'transform 0.85s cubic-bezier(0.16, 1, 0.3, 1)' }
            : undefined
        }
      >
        {slides.map((s, idx) => (
          <div
            key={s.id}
            className={
              slideMode
                ? 'relative h-full'
                : `absolute inset-0 transition-opacity duration-700 ${idx === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`
            }
            style={slideMode ? { width: `${100 / n}%` } : undefined}
            aria-hidden={idx !== i}
          >
            {s.type === 'VIDEO' ? <video src={s.media} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" /> :
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.media} alt={s.title1 ?? 'بانر'} className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-l from-black/85 via-black/55 to-black/20" />
            <div className={`relative mx-auto flex h-full max-w-6xl flex-col items-start justify-center px-4 text-white transition-all duration-700 ${idx === i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              {s.badge && <span className="mb-5 rounded-full bg-acc px-4 py-1.5 text-xs font-black text-black">{s.badge}</span>}
              {(s.title1 || s.title2) && <h1 className="max-w-2xl text-4xl font-black leading-[1.15] sm:text-6xl">{s.title1}{s.title2 && <><br /><span className="text-acc">{s.title2}</span></>}</h1>}
              {s.subtitle && <p className="mt-5 max-w-xl text-base opacity-90 sm:text-lg">{s.subtitle}</p>}
              {s.ctaText && <button onClick={onCta} className="mt-7 rounded-xl bg-acc px-8 py-3.5 font-black text-black transition hover:bg-acc-dark glow-acc">{s.ctaText}</button>}
            </div>
          </div>
        ))}
      </div>
      {n > 1 && (
        <>
          <button onClick={() => go(i - 1)} aria-label="السابق" className="absolute top-1/2 right-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-acc hover:text-black"><ChevronRight className="w-6 h-6" /></button>
          <button onClick={() => go(i + 1)} aria-label="التالي" className="absolute top-1/2 left-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-acc hover:text-black"><ChevronLeft className="w-6 h-6" /></button>
          <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2">
            {slides.map((s, idx) => <button key={s.id} onClick={() => go(idx)} aria-label={`شريحة ${idx + 1}`} className={`h-2 rounded-full transition-all ${idx === i ? 'w-8 bg-acc' : 'w-2 bg-white/50 hover:bg-white'}`} />)}
          </div>
        </>
      )}
    </section>
  )
}

/* ===== عناصر مساعدة ===== */
function AccentStyles() {
  return (
    <style>{`
      .text-acc{color:var(--acc)}
      .bg-acc{background-color:var(--acc)}
      .bg-acc-10{background-color:color-mix(in srgb, var(--acc) 12%, transparent)}
      .border-acc-40{border-color:color-mix(in srgb, var(--acc) 45%, transparent)}
      .hover\\:text-acc:hover{color:var(--acc)}
      .hover\\:bg-acc:hover{background-color:var(--acc)}
      .hover\\:bg-acc-dark:hover{background-color:var(--acc);filter:brightness(0.9)}
      .hover\\:border-acc-40:hover{border-color:color-mix(in srgb, var(--acc) 45%, transparent)}
      .glow-acc{box-shadow:0 0 40px -8px color-mix(in srgb, var(--acc) 55%, transparent)}
      [data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .6s cubic-bezier(.16,1,.3,1),transform .6s cubic-bezier(.16,1,.3,1)}
      [data-reveal].reveal-in{opacity:1;transform:none}
      @keyframes toast-up{from{transform:translate(-50%,16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
      .toast-in{animation:toast-up .25s cubic-bezier(.16,1,.3,1)}
    `}</style>
  )
}
function SectionTitle({ title, icon, onMore }: { title: string; icon?: React.ReactNode; onMore: () => void }) {
  return (
    <div className="relative flex items-center justify-center mb-8">
      <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-2 text-center">{icon}{title}</h2>
      <button onClick={onMore} className="absolute right-0 text-sm text-acc font-bold flex flex-col items-start leading-tight hover:opacity-80 transition">
        <span>شاهد</span>
        <span className="underline underline-offset-4">المزيد</span>
      </button>
    </div>
  )
}
function FilterItem({ active, onClick, children, light }: { active: boolean; onClick: () => void; children: React.ReactNode; light: boolean }) {
  return <button onClick={onClick} className={`w-full text-right px-3 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-acc text-black' : light ? 'text-gray-600 hover:bg-black/5' : 'text-gray-300 hover:bg-white/5'}`}>{children}</button>
}
function Badge({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <span className={`absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-black flex items-center justify-center tabular-nums ${dark ? 'bg-black text-acc' : 'bg-[#e94560] text-white'}`}>{children}</span>
}
function Thumb({ url, light }: { url: string | null; light: boolean }) {
  return <div className={`w-14 h-14 rounded-xl ${light ? 'bg-black/5' : 'bg-white/5'} flex items-center justify-center shrink-0 overflow-hidden`}>{url ?
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="w-full h-full object-cover" /> : <Coffee className="w-6 h-6 opacity-20" />}</div>
}
function Row({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="flex justify-between text-sm"><span className={sub}>{label}</span><span className="tabular-nums">{value}</span></div>
}
function Field({ placeholder, value, onChange, type = 'text', light }: { placeholder: string; value: string; onChange: (v: string) => void; type?: string; light: boolean }) {
  return <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:border-acc-40 text-sm ${light ? 'bg-black/5 border-black/10' : 'bg-[#0f0f11] border-white/10'}`} />
}
