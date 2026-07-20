'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Coffee,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Search,
  Phone,
  MessageCircle,
  CheckCircle2,
  MapPin,
} from 'lucide-react'

interface StoreProduct {
  id: string
  name: string
  unit: string
  price: number
  stock: number
  categoryId: string | null
  imageUrl: string | null
}
interface Category {
  id: string
  name: string
}
interface Settings {
  storeName: string
  tagline: string
  heroImage: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  deliveryFee: number
  minOrder: number
  isOpen: boolean
  showOutOfStock: boolean
}
interface CartLine {
  productId: string
  name: string
  price: number
  unit: string
  quantity: number
  stock: number
  imageUrl: string | null
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const CART_KEY = 'albadr-store-cart'

export function Storefront({
  settings,
  products,
  categories,
}: {
  settings: Settings
  products: StoreProduct[]
  categories: Category[]
}) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [form, setForm] = useState({ customerName: '', phone: '', address: '', notes: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  // تحميل السلة من localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY)
      if (saved) setCart(JSON.parse(saved))
    } catch {}
  }, [])
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  const filtered = useMemo(
    () => products.filter((p) => p.name.includes(search.trim()) && (!cat || p.categoryId === cat)),
    [products, search, cat]
  )

  const add = (p: StoreProduct) => {
    if (p.stock <= 0) return
    setCart((prev) => {
      const ex = prev.find((c) => c.productId === p.id)
      if (ex) {
        if (ex.quantity >= p.stock) return prev
        return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, unit: p.unit, quantity: 1, stock: p.stock, imageUrl: p.imageUrl }]
    })
    setCartOpen(true)
  }
  const changeQty = (id: string, d: number) =>
    setCart((prev) =>
      prev.map((c) => (c.productId === id ? { ...c, quantity: Math.min(c.stock, Math.max(0, c.quantity + d)) } : c)).filter((c) => c.quantity > 0)
    )
  const remove = (id: string) => setCart((prev) => prev.filter((c) => c.productId !== id))

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const count = cart.reduce((s, c) => s + c.quantity, 0)
  const total = subtotal + (subtotal > 0 ? settings.deliveryFee : 0)

  const submit = async () => {
    setError('')
    if (!form.customerName || !form.phone || !form.address) {
      setError('اكتب الاسم والتليفون والعنوان')
      return
    }
    if (settings.minOrder > 0 && subtotal < settings.minOrder) {
      setError(`الحد الأدنى للطلب ${fmt(settings.minOrder)} ج.م`)
      return
    }
    setLoading(true)
    const res = await fetch('/api/store/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'فشل الطلب'); return }
    setDone(data.orderNo)
    setCart([])
    setCheckout(false)
    setCartOpen(false)
  }

  return (
    <div dir="rtl">
      {/* الهيدر */}
      <header className="sticky top-0 z-40 bg-[#1a1a2e] text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image src="/logo-header.png" alt="البدر" width={40} height={40} className="shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{settings.storeName}</p>
              <p className="text-[11px] text-[#e9b44c] truncate">قهوة طازجة أونلاين</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {settings.whatsapp && (
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-xs font-semibold"
              >
                <MessageCircle className="w-4 h-4" /> واتساب
              </a>
            )}
            <button onClick={() => setCartOpen(true)} className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e94560] hover:bg-[#c73e54] text-sm font-semibold">
              <ShoppingCart className="w-4 h-4" />
              السلة
              {count > 0 && (
                <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[#e9b44c] text-[#1a1a2e] text-xs font-bold flex items-center justify-center tabular-nums">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* الهيرو */}
      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <Coffee className="w-8 h-8 text-[#e9b44c]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{settings.storeName}</h1>
          <p className="text-[#e9b44c] text-lg">{settings.tagline}</p>
          {!settings.isOpen && (
            <p className="mt-4 inline-block bg-red-500/20 text-red-200 px-4 py-2 rounded-lg text-sm">المتجر مقفول حاليًا</p>
          )}
        </div>
      </section>

      {/* البحث والتصنيفات */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="relative mb-4 max-w-md mx-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="دوّر على قهوتك المفضلة..."
            className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            <button onClick={() => setCat('')} className={`px-4 py-2 rounded-full text-sm font-semibold ${!cat ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              الكل
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id === cat ? '' : c.id)} className={`px-4 py-2 rounded-full text-sm font-semibold ${cat === c.id ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* شبكة المنتجات */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const out = p.stock <= 0
            return (
              <div key={p.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="aspect-square bg-gray-50 flex items-center justify-center">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-3" loading="lazy" />
                  ) : (
                    <Coffee className="w-12 h-12 text-[#1a1a2e]/20" />
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <p className="font-semibold text-sm text-[#1a1a2e] leading-snug line-clamp-2 min-h-10">{p.name}</p>
                  <p className="text-[#e94560] font-bold text-lg mt-1 tabular-nums">{fmt(p.price)} ج.م</p>
                  <button
                    onClick={() => add(p)}
                    disabled={out || !settings.isOpen}
                    className="mt-2 w-full py-2 rounded-lg bg-[#1a1a2e] text-white text-sm font-semibold hover:bg-[#0f3460] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {out ? 'نفد المخزون' : 'أضف للسلة'}
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-16">مفيش منتجات متاحة حاليًا.</p>
          )}
        </div>
      </div>

      {/* الفوتر */}
      <footer className="bg-[#1a1a2e] text-white/70 mt-10">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p>© {settings.storeName}</p>
          <div className="flex items-center gap-4">
            {settings.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {settings.phone}</span>}
            {settings.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {settings.address}</span>}
          </div>
        </div>
      </footer>

      {/* درج السلة */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#e94560]" /> سلة الطلب
              </h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 && <p className="text-gray-400 text-center py-10">السلة فاضية</p>}
              {cart.map((c) => (
                <div key={c.productId} className="flex items-center gap-3 border-b border-gray-50 pb-3">
                  <div className="w-14 h-14 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Coffee className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <p className="text-[#e94560] font-bold text-sm tabular-nums">{fmt(c.price)} ج.م</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(c.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-6 text-center font-bold text-sm tabular-nums">{c.quantity}</span>
                    <button onClick={() => changeQty(c.productId, 1)} disabled={c.quantity >= c.stock} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={() => remove(c.productId)} className="text-gray-300 hover:text-red-500" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="border-t p-4 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-gray-500">الإجمالي</span><span className="tabular-nums">{fmt(subtotal)} ج.م</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">التوصيل</span><span className="tabular-nums">{fmt(settings.deliveryFee)} ج.م</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>المجموع</span><span className="tabular-nums text-[#e94560]">{fmt(total)} ج.م</span></div>
                <button onClick={() => setCheckout(true)} className="w-full py-3 rounded-xl bg-[#e94560] text-white font-bold hover:bg-[#c73e54]">
                  إتمام الطلب
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نموذج إتمام الطلب */}
      {checkout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCheckout(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">بيانات التوصيل</h3>
              <button onClick={() => setCheckout(false)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
            <input placeholder="الاسم" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm" />
            <input type="tel" placeholder="رقم التليفون" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm" />
            <textarea placeholder="العنوان بالتفصيل" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm resize-none" />
            <input placeholder="ملاحظات (اختياري)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm" />
            <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-sm text-center font-semibold">💵 الدفع عند الاستلام</div>
            <div className="flex justify-between font-bold text-lg"><span>المجموع</span><span className="tabular-nums text-[#e94560]">{fmt(total)} ج.م</span></div>
            <button onClick={submit} disabled={loading} className="w-full py-3.5 rounded-xl bg-[#e94560] text-white font-bold hover:bg-[#c73e54] disabled:opacity-50">
              {loading ? 'جاري الإرسال...' : 'تأكيد الطلب'}
            </button>
          </div>
        </div>
      )}

      {/* تأكيد نجاح الطلب */}
      {done && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h3 className="font-bold text-xl">تم استلام طلبك!</h3>
            <p className="text-gray-500 text-sm">رقم الطلب: <span className="font-bold tabular-nums">{done}</span></p>
            <p className="text-gray-500 text-sm">هنتواصل معاك على التليفون لتأكيد الطلب والتوصيل.</p>
            <button onClick={() => setDone(null)} className="w-full py-3 rounded-xl bg-[#1a1a2e] text-white font-semibold hover:bg-[#0f3460]">تمام</button>
          </div>
        </div>
      )}
    </div>
  )
}
