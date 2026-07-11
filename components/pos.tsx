'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Coffee,
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Search,
  Printer,
  CheckCircle2,
  UserPlus,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  unit: string
  sellPrice: number
  quantity: number
}

interface Customer {
  id: string
  name: string
}

interface CartItem {
  productId: string
  name: string
  unit: string
  unitPrice: number
  quantity: number
  available: number
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function Pos({ products, customers }: { products: Product[]; customers: Customer[] }) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [type, setType] = useState<'CASH' | 'CREDIT'>('CASH')
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<{ id: string; invoiceNo: string } | null>(null)

  const filtered = useMemo(
    () => products.filter((p) => p.name.includes(search.trim())),
    [products, search]
  )

  const addToCart = (p: Product) => {
    setLastInvoice(null)
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id)
      if (existing) {
        if (existing.quantity >= p.quantity) return prev
        return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [...prev, { productId: p.id, name: p.name, unit: p.unit, unitPrice: p.sellPrice, quantity: 1, available: p.quantity }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.productId === productId
            ? { ...c, quantity: Math.min(c.available, Math.max(0, c.quantity + delta)) }
            : c
        )
        .filter((c) => c.quantity > 0)
    )
  }

  const changePrice = (productId: string, price: string) => {
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, unitPrice: Number(price) || 0 } : c)))
  }

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0)
  const discountPct = Math.min(100, Math.max(0, Number(discount) || 0))
  const net = subtotal - (subtotal * discountPct) / 100

  const checkout = async () => {
    setError('')
    if (cart.length === 0) {
      setError('السلة فاضية — اختار منتجات الأول')
      return
    }
    let finalCustomerId = customerId
    if (!finalCustomerId && !newCustomer.trim()) {
      setError('اختار عميل أو سجّل عميل جديد')
      return
    }

    setLoading(true)

    if (!finalCustomerId && newCustomer.trim()) {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomer.trim(), type }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLoading(false)
        setError(data.error || 'فشل تسجيل العميل')
        return
      }
      finalCustomerId = data.id
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: finalCustomerId,
        type,
        discount: discountPct,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice })),
      }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'فشل إنشاء الفاتورة')
      return
    }

    setLastInvoice({ id: data.id, invoiceNo: data.invoiceNo })
    setCart([])
    setCustomerId('')
    setNewCustomer('')
    setDiscount('0')
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* شبكة المنتجات */}
      <div className="xl:col-span-3">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="دوّر على منتج..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto">
            {filtered.map((p) => {
              const inCart = cart.find((c) => c.productId === p.id)
              const out = p.quantity <= 0
              return (
                <button
                  key={p.id}
                  onClick={() => !out && addToCart(p)}
                  disabled={out}
                  className={`relative text-right p-4 rounded-xl border-2 transition-all ${
                    out
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : inCart
                        ? 'border-[#e94560] bg-[#e94560]/5'
                        : 'border-gray-100 hover:border-[#e94560]/40 hover:shadow-sm'
                  }`}
                >
                  {inCart && (
                    <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#e94560] text-white text-xs font-bold flex items-center justify-center tabular-nums">
                      {inCart.quantity}
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-lg bg-[#1a1a2e]/5 flex items-center justify-center mb-2">
                    <Coffee className="w-4.5 h-4.5 w-5 h-5 text-[#1a1a2e]" strokeWidth={1.8} />
                  </div>
                  <p className="font-semibold text-sm text-[#1a1a2e] leading-snug">{p.name}</p>
                  <p className="text-[#e94560] font-bold text-base mt-1 tabular-nums">{fmt(p.sellPrice)} ج.م</p>
                  <p className={`text-xs mt-0.5 tabular-nums ${out ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    {out ? 'نفد المخزون' : `متاح: ${p.quantity} ${p.unit}`}
                  </p>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-sm text-gray-500 py-10">مفيش منتجات مطابقة.</p>
            )}
          </div>
        </div>
      </div>

      {/* السلة */}
      <div className="xl:col-span-2">
        <div className="bg-white rounded-xl shadow-sm p-5 sticky top-6 space-y-4">
          <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#e94560]" />
            الفاتورة الحالية
            {cart.length > 0 && <span className="text-xs text-gray-400">({cart.length} صنف)</span>}
          </h3>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          {lastInvoice && (
            <div className="bg-green-50 p-4 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                اتسجلت {lastInvoice.invoiceNo}
              </div>
              <a
                href={`/print/invoice/${lastInvoice.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f3460] text-white rounded-lg text-xs font-semibold hover:bg-[#0a2545]"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة
              </a>
            </div>
          )}

          {/* عناصر السلة */}
          <div className="space-y-2.5 max-h-56 overflow-y-auto">
            {cart.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">اضغط على منتج عشان يضاف هنا</p>
            )}
            {cart.map((c) => (
              <div key={c.productId} className="flex items-center gap-2 pb-2.5 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={c.unitPrice}
                      onChange={(e) => changePrice(c.productId, e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-200 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-[#e94560]"
                    />
                    <span className="text-xs text-gray-400">ج.م / {c.unit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => changeQty(c.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center font-bold text-sm tabular-nums">{c.quantity}</span>
                  <button
                    onClick={() => changeQty(c.productId, 1)}
                    disabled={c.quantity >= c.available}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="w-20 text-left font-bold text-sm tabular-nums">{fmt(c.quantity * c.unitPrice)}</p>
                <button onClick={() => changeQty(c.productId, -c.quantity)} className="text-gray-300 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* العميل */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-gray-700">العميل</label>
              <button
                type="button"
                onClick={() => { setShowNewCustomer(!showNewCustomer); setCustomerId(''); setNewCustomer('') }}
                className="flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {showNewCustomer ? 'اختيار عميل موجود' : 'عميل جديد'}
              </button>
            </div>
            {showNewCustomer ? (
              <input
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="اسم العميل الجديد"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
              />
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
              >
                <option value="">اختار العميل</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* الدفع والخصم */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">طريقة الدفع</label>
              <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-gray-200">
                <button
                  type="button"
                  onClick={() => setType('CASH')}
                  className={`py-2 text-sm font-semibold transition-colors ${type === 'CASH' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  نقدي
                </button>
                <button
                  type="button"
                  onClick={() => setType('CREDIT')}
                  className={`py-2 text-sm font-semibold transition-colors ${type === 'CREDIT' ? 'bg-yellow-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  آجل
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">الخصم %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm tabular-nums"
              />
            </div>
          </div>

          {/* الإجمالي */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>الإجمالي</span>
              <span className="tabular-nums">{fmt(subtotal)} ج.م</span>
            </div>
            {discountPct > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>الخصم ({discountPct}%)</span>
                <span className="tabular-nums text-red-500">- {fmt(subtotal - net)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-[#1a1a2e] border-t border-gray-200 pt-1.5">
              <span>الصافي</span>
              <span className="tabular-nums">{fmt(net)} ج.م</span>
            </div>
          </div>

          <button
            onClick={checkout}
            disabled={loading || cart.length === 0}
            className="w-full bg-[#e94560] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#c73e54] disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري التسجيل...' : `تأكيد البيع — ${fmt(net)} ج.م`}
          </button>
        </div>
      </div>
    </div>
  )
}
