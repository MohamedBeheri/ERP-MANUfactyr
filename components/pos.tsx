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
  Warehouse as WarehouseIcon,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  unit: string
  sellPrice: number
  wholesalePrice: number
  quantity: number
  categoryId: string | null
  imageUrl: string | null
}

const PAYMENT_METHODS = ['نقدي', 'فيزا', 'انستاباي', 'مختلط'] as const

interface Customer {
  id: string
  name: string
  customerType: 'RETAIL' | 'WHOLESALE'
  tier: { name: string; priceSource: string; discountPercent: number } | null
}

interface Category {
  id: string
  name: string
}

interface WarehouseOption {
  id: string
  name: string
  isDefault: boolean
}

interface CartItem {
  productId: string
  name: string
  unit: string
  unitPrice: number
  priceEdited: boolean
  quantity: number
  available: number
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function Pos({
  products,
  customers,
  categories,
  warehouses,
}: {
  products: Product[]
  customers: Customer[]
  categories: Category[]
  warehouses: WarehouseOption[]
}) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState('')
  const [newCustomerType, setNewCustomerType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '')
  const [type, setType] = useState<'CASH' | 'CREDIT'>('CASH')
  const [paymentMethod, setPaymentMethod] = useState<string>('نقدي')
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<{ id: string; invoiceNo: string } | null>(null)

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const isWholesale = showNewCustomer ? newCustomerType === 'WHOLESALE' : selectedCustomer?.customerType === 'WHOLESALE'
  // العميل القطاعي مفيش آجل — دفع فوري بس
  const effectiveType = isWholesale ? type : 'CASH'

  const activeTier = showNewCustomer ? null : selectedCustomer?.tier || null
  const priceOf = (p: Product) => {
    if (activeTier) {
      const base = activeTier.priceSource === 'WHOLESALE' && p.wholesalePrice > 0 ? p.wholesalePrice : p.sellPrice
      return Math.max(0, Math.round(base * (1 - activeTier.discountPercent / 100) * 100) / 100)
    }
    return isWholesale && p.wholesalePrice > 0 ? p.wholesalePrice : p.sellPrice
  }

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.includes(search.trim()) &&
          (!categoryFilter || p.categoryId === categoryFilter)
      ),
    [products, search, categoryFilter]
  )

  // لما نوع العميل يتغيّر، الأسعار اللي متعدّلتش يدوي بتتحدث تلقائي
  const repriceCart = (cust?: Customer | null, newTypeWholesale?: boolean) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.priceEdited) return c
        const p = products.find((pr) => pr.id === c.productId)
        if (!p) return c
        let price: number
        if (cust?.tier) {
          const base = cust.tier.priceSource === 'WHOLESALE' && p.wholesalePrice > 0 ? p.wholesalePrice : p.sellPrice
          price = Math.max(0, Math.round(base * (1 - cust.tier.discountPercent / 100) * 100) / 100)
        } else {
          const wholesale = cust ? cust.customerType === 'WHOLESALE' : !!newTypeWholesale
          price = wholesale && p.wholesalePrice > 0 ? p.wholesalePrice : p.sellPrice
        }
        return { ...c, unitPrice: price }
      })
    )
  }

  const addToCart = (p: Product) => {
    setLastInvoice(null)
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id)
      if (existing) {
        if (existing.quantity >= p.quantity) return prev
        return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [
        ...prev,
        { productId: p.id, name: p.name, unit: p.unit, unitPrice: priceOf(p), priceEdited: false, quantity: 1, available: p.quantity },
      ]
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
    setCart((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, unitPrice: Number(price) || 0, priceEdited: true } : c))
    )
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
        body: JSON.stringify({ name: newCustomer.trim(), type, customerType: newCustomerType }),
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
        type: effectiveType,
        paymentMethod: effectiveType === 'CASH' ? paymentMethod : 'آجل',
        discount: discountPct,
        warehouseId,
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
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      {/* شبكة المنتجات */}
      <div className="xl:col-span-3 bg-white rounded-xl shadow-sm p-5">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="دوّر على منتج..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
            />
          </div>
          {warehouses.length > 1 && (
            <div className="flex items-center gap-2">
              <WarehouseIcon className="w-4 h-4 text-gray-400" />
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* تبويبات التصنيفات */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                !categoryFilter ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              الكل
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id === categoryFilter ? '' : c.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  categoryFilter === c.id ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto">
          {filtered.map((p) => {
            const inCart = cart.find((c) => c.productId === p.id)
            const out = p.quantity <= 0
            const price = priceOf(p)
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
                      : 'border-gray-100 hover:border-[#e94560]/40 hover:shadow-md'
                }`}
              >
                {inCart && (
                  <span className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-[#e94560] text-white text-xs font-bold flex items-center justify-center tabular-nums">
                    {inCart.quantity}
                  </span>
                )}
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-full h-24 object-contain rounded-lg bg-gray-50 mb-2.5"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-24 rounded-lg bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center mb-2.5">
                    <Coffee className="w-8 h-8 text-[#e9b44c]" strokeWidth={1.5} />
                  </div>
                )}
                <p className="font-semibold text-sm text-[#1a1a2e] leading-snug">{p.name}</p>
                <p className="text-[#e94560] font-bold text-base mt-1 tabular-nums">
                  {fmt(price)} ج.م
                  {isWholesale && p.wholesalePrice > 0 && (
                    <span className="mr-1.5 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">جملة</span>
                  )}
                </p>
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

      {/* السلة */}
      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-5 sticky top-6 space-y-4">
        <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-[#e94560]" />
          الفاتورة الحالية
          {cart.length > 0 && <span className="text-xs text-gray-400">({cart.length} صنف)</span>}
          {activeTier ? (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold mr-auto">
              {activeTier.name}{activeTier.discountPercent > 0 ? ` −${activeTier.discountPercent}%` : ''}
            </span>
          ) : isWholesale ? (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold mr-auto">أسعار جملة</span>
          ) : null}
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

        <div className="space-y-2.5 max-h-52 overflow-y-auto">
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
                <button onClick={() => changeQty(c.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center" aria-label="تقليل">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-bold text-sm tabular-nums">{c.quantity}</span>
                <button
                  onClick={() => changeQty(c.productId, 1)}
                  disabled={c.quantity >= c.available}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40"
                  aria-label="زيادة"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="w-20 text-left font-bold text-sm tabular-nums">{fmt(c.quantity * c.unitPrice)}</p>
              <button onClick={() => changeQty(c.productId, -c.quantity)} className="text-gray-300 hover:text-red-500" aria-label="حذف">
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
            <div className="flex gap-2">
              <input
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="اسم العميل الجديد"
                className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
              />
              <select
                value={newCustomerType}
                onChange={(e) => { const v = e.target.value as 'RETAIL' | 'WHOLESALE'; setNewCustomerType(v); repriceCart(null, v === 'WHOLESALE') }}
                className="w-24 shrink-0 px-2 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
              >
                <option value="RETAIL">قطاعي</option>
                <option value="WHOLESALE">جملة</option>
              </select>
            </div>
          ) : (
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value)
                const cust = customers.find((c) => c.id === e.target.value)
                repriceCart(cust || null)
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
            >
              <option value="">اختار العميل</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.tier ? c.tier.name : c.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي'})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* نظام الدفع والخصم */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">نظام الدفع</label>
            <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-gray-200">
              <button
                type="button"
                onClick={() => setType('CASH')}
                className={`py-2 text-sm font-semibold transition-colors ${effectiveType === 'CASH' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                فوري
              </button>
              <button
                type="button"
                onClick={() => isWholesale && setType('CREDIT')}
                disabled={!isWholesale}
                title={!isWholesale ? 'الآجل لعملاء الجملة فقط' : undefined}
                className={`py-2 text-sm font-semibold transition-colors ${effectiveType === 'CREDIT' ? 'bg-yellow-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                آجل
              </button>
            </div>
            {!isWholesale && (
              <p className="text-[10px] text-gray-400 mt-1">الآجل لعملاء الجملة فقط</p>
            )}
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

        {/* طريقة الدفع (للدفع الفوري) */}
        {effectiveType === 'CASH' && (
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">طريقة الدفع</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    paymentMethod === m
                      ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

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
  )
}
