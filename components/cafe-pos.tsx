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
  X,
  Delete,
  Banknote,
} from 'lucide-react'
import { SearchableSelect } from '@/components/searchable-select'

interface Product {
  id: string
  name: string
  unit: string
  sellPrice: number
  wholesalePrice: number
  quantity: number
  categoryId: string | null
  imageUrl: string | null
  // صنف كافيه بتوليفة: بيتحضّر وقت البيع — رصيده من الخامات مش من كمية المنتج
  hasRecipe?: boolean
}

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

const PAYMENT_METHODS = ['نقدي', 'فيزا', 'انستاباي', 'مختلط'] as const
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

// نقطة البيع بتصميم seaside: شبكة منتجات + شرائح تصنيفات على الشمال،
// سلة ثابتة الرأس والذيل على اليمين، ومودال دفع بكيباد كاش وحساب الباقي
export function CafePos({
  products,
  customers,
  categories,
  warehouses,
  cafeWarehouseId,
  canAdd = true,
}: {
  products: Product[]
  customers: Customer[]
  categories: Category[]
  warehouses: WarehouseOption[]
  cafeWarehouseId?: string
  canAdd?: boolean
}) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerType, setNewCustomerType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  // الكافيه بيبيع دايمًا من مخزن الكافيه — مفيش اختيار مخزن
  const warehouseId = cafeWarehouseId || warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ''
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState('')
  const [lastInvoice, setLastInvoice] = useState<{ id: string; invoiceNo: string } | null>(null)
  const [payOpen, setPayOpen] = useState(false)

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const isWholesale = showNewCustomer ? newCustomerType === 'WHOLESALE' : selectedCustomer?.customerType === 'WHOLESALE'
  const activeTier = showNewCustomer ? null : selectedCustomer?.tier || null

  const priceOf = (p: Product) => {
    if (activeTier) {
      const base = activeTier.priceSource === 'WHOLESALE' && p.wholesalePrice > 0 ? p.wholesalePrice : p.sellPrice
      return Math.max(0, Math.round(base * (1 - activeTier.discountPercent / 100) * 100) / 100)
    }
    return isWholesale && p.wholesalePrice > 0 ? p.wholesalePrice : p.sellPrice
  }

  const filtered = useMemo(
    () => products.filter((p) => p.name.includes(search.trim()) && (!categoryFilter || p.categoryId === categoryFilter)),
    [products, search, categoryFilter]
  )

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
        if (!p.hasRecipe && existing.quantity >= p.quantity) return prev
        return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [...prev, { productId: p.id, name: p.name, unit: p.unit, unitPrice: priceOf(p), priceEdited: false, quantity: 1, available: p.hasRecipe ? Infinity : p.quantity }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.productId === productId ? { ...c, quantity: Math.min(c.available, Math.max(0, c.quantity + delta)) } : c))
        .filter((c) => c.quantity > 0)
    )
  }

  const changePrice = (productId: string, price: string) => {
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, unitPrice: Number(price) || 0, priceEdited: true } : c)))
  }

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0)
  const discountPct = Math.min(100, Math.max(0, Number(discount) || 0))
  const net = subtotal - (subtotal * discountPct) / 100

  // التليفون إجباري للعميل الجديد ولازم 11 رقم (بنقبل الأرقام العربية)
  const phoneDigits = (p: string) => p.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')
  const newPhoneInvalid = phoneDigits(newCustomerPhone).length !== 11

  const openPay = () => {
    setError('')
    if (cart.length === 0) return setError('السلة فاضية — اختار منتجات الأول')
    if (!customerId && !newCustomer.trim()) return setError('اختار عميل أو سجّل عميل جديد')
    if (!customerId && newCustomer.trim() && newPhoneInvalid) return setError('رقم تليفون العميل الجديد مطلوب ولازم يكون 11 رقم')
    setPayOpen(true)
  }

  const submitSale = async (method: string, type: 'CASH' | 'CREDIT') => {
    let finalCustomerId = customerId
    if (!finalCustomerId && newCustomer.trim()) {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomer.trim(), phone: newCustomerPhone.trim(), type, customerType: newCustomerType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل العميل')
      finalCustomerId = data.id
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: finalCustomerId,
        type,
        paymentMethod: type === 'CASH' ? method : 'آجل',
        discount: discountPct,
        warehouseId,
        cafeSale: true,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice })),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء الفاتورة')

    setLastInvoice({ id: data.id, invoiceNo: data.invoiceNo })
    // فتح إيصال الكاشير للطباعة فورًا بعد البيع
    if (data.id) window.open(`/print/invoice-receipt/${data.id}`, '_blank')
    setCart([])
    setCustomerId('')
    setNewCustomer('')
    setNewCustomerPhone('')
    setDiscount('0')
    setPayOpen(false)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-stretch lg:h-[calc(100vh-230px)] lg:min-h-[560px]">
      {/* ─── قائمة المنتجات ─── */}
      <div className="bg-white rounded-xl shadow-sm flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 pb-0 shrink-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-44">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="دوّر على منتج..."
                className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#e94560]/5 border border-[#e94560]/20 rounded-lg text-sm text-[#e94560] font-semibold whitespace-nowrap">
              <WarehouseIcon className="w-4 h-4" /> مخزن الكافيه
            </div>
          </div>

          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setCategoryFilter('')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  !categoryFilter ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                الكل
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id === categoryFilter ? '' : c.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    categoryFilter === c.id ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => {
              const inCart = cart.find((c) => c.productId === p.id)
              const out = !p.hasRecipe && p.quantity <= 0
              const price = priceOf(p)
              return (
                <button
                  key={p.id}
                  onClick={() => !out && addToCart(p)}
                  disabled={out}
                  className={`relative text-right p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
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
                    <img src={p.imageUrl} alt={p.name} className="w-full h-20 object-contain rounded-lg bg-gray-50 mb-2" loading="lazy" />
                  ) : (
                    <div className="w-full h-20 rounded-lg bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center mb-2">
                      <Coffee className="w-7 h-7 text-[#e9b44c]" strokeWidth={1.5} />
                    </div>
                  )}
                  <p className="font-semibold text-sm text-[#1a1a2e] leading-snug line-clamp-2">{p.name}</p>
                  <p className="text-[#e94560] font-bold text-sm mt-1 tabular-nums">
                    {fmt(price)} ج.م
                    {isWholesale && p.wholesalePrice > 0 && (
                      <span className="mr-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">جملة</span>
                    )}
                  </p>
                  <p className={`text-[11px] mt-0.5 tabular-nums ${out ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    {out ? 'نفد المخزون' : p.hasRecipe ? 'تحضير طازج — من الخامات' : `متاح: ${p.quantity} ${p.unit}`}
                  </p>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="col-span-full text-center text-sm text-gray-500 py-10">مفيش منتجات مطابقة.</p>}
          </div>
        </div>
      </div>

      {/* ─── السلة ─── */}
      <div className="bg-white rounded-xl shadow-sm flex flex-col min-h-0 overflow-hidden">
        {/* رأس السلة */}
        <div className="p-4 pb-3 shrink-0 border-b border-gray-100 space-y-3">
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">العميل</label>
              <button
                type="button"
                onClick={() => { setShowNewCustomer(!showNewCustomer); setCustomerId(''); setNewCustomer(''); setNewCustomerPhone('') }}
                className="flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {showNewCustomer ? 'اختيار عميل موجود' : 'عميل جديد'}
              </button>
            </div>
            {showNewCustomer ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={newCustomer}
                    onChange={(e) => setNewCustomer(e.target.value)}
                    placeholder="اسم العميل الجديد"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
                  />
                  <select
                    value={newCustomerType}
                    onChange={(e) => { const v = e.target.value as 'RETAIL' | 'WHOLESALE'; setNewCustomerType(v); repriceCart(null, v === 'WHOLESALE') }}
                    className="w-24 shrink-0 px-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
                  >
                    <option value="RETAIL">قطاعي</option>
                    <option value="WHOLESALE">جملة</option>
                  </select>
                </div>
                <input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="رقم التليفون * (11 رقم)"
                  dir="ltr" inputMode="tel" maxLength={11}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm ${newPhoneInvalid && newCustomerPhone.trim() !== '' ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
            ) : (
              <SearchableSelect
                value={customerId}
                onChange={(v) => {
                  setCustomerId(v)
                  const cust = customers.find((c) => c.id === v)
                  repriceCart(cust || null)
                }}
                placeholder="اختار العميل"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm"
                options={customers.map((c) => ({
                  value: c.id,
                  label: c.name,
                  sublabel: c.tier ? c.tier.name : c.customerType === 'WHOLESALE' ? 'جملة' : 'قطاعي',
                }))}
              />
            )}
          </div>
        </div>

        {/* بنود السلة */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          {lastInvoice && (
            <div className="bg-green-50 p-3.5 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                اتسجلت {lastInvoice.invoiceNo}
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={`/print/invoice-receipt/${lastInvoice.id}`}
                  target="_blank"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f3460] text-white rounded-lg text-xs font-semibold hover:bg-[#0a2545]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  إيصال كاشير
                </a>
                <a
                  href={`/print/invoice/${lastInvoice.id}`}
                  target="_blank"
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200"
                >
                  فاتورة A4
                </a>
              </div>
            </div>
          )}
          {cart.length === 0 && !lastInvoice && (
            <p className="text-sm text-gray-400 text-center py-10">اضغط على منتج عشان يضاف هنا</p>
          )}
          {cart.map((c) => (
            <div key={c.productId} className="flex items-center gap-2 pb-2.5 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="text" inputMode="decimal" dir="ltr"
                    value={c.unitPrice}
                    onChange={(e) => changePrice(c.productId, e.target.value)}
                    className="w-18 max-w-20 px-2 py-1 border border-gray-200 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-[#e94560]"
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
              <p className="w-16 text-left font-bold text-sm tabular-nums shrink-0">{fmt(c.quantity * c.unitPrice)}</p>
              <button onClick={() => changeQty(c.productId, -c.quantity)} className="text-gray-300 hover:text-red-500" aria-label="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* ذيل السلة */}
        <div className="p-4 pt-3 shrink-0 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
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
              <div className="flex justify-between font-bold text-lg text-[#1a1a2e] border-t border-gray-200 pt-1">
                <span>الصافي</span>
                <span className="tabular-nums">{fmt(net)} ج.م</span>
              </div>
            </div>
            <div className="w-24 shrink-0">
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">الخصم %</label>
              <input
                type="text" inputMode="decimal" dir="ltr"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm tabular-nums"
              />
            </div>
          </div>

          {canAdd && (
            <button
              onClick={openPay}
              disabled={cart.length === 0}
              className="w-full bg-[#e94560] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#c73e54] disabled:opacity-50 transition-colors"
            >
              الدفع — {fmt(net)} ج.م
            </button>
          )}
        </div>
      </div>

      {payOpen && (
        <PayModal
          net={net}
          isWholesale={isWholesale}
          onClose={() => setPayOpen(false)}
          onConfirm={submitSale}
        />
      )}
    </div>
  )
}

// مودال الدفع: طرق الدفع + كيباد كاش بحساب الباقي، والآجل لعملاء الجملة فقط
function PayModal({
  net,
  isWholesale,
  onClose,
  onConfirm,
}: {
  net: number
  isWholesale: boolean
  onClose: () => void
  onConfirm: (method: string, type: 'CASH' | 'CREDIT') => Promise<void>
}) {
  const [method, setMethod] = useState<string>('نقدي')
  const [credit, setCredit] = useState(false)
  const [tendered, setTendered] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tenderedNum = Number(tendered) || 0
  const change = tenderedNum - net

  const press = (k: string) => {
    setTendered((prev) => {
      if (k === '⌫') return prev.slice(0, -1)
      if (k === '.' && prev.includes('.')) return prev
      return (prev + k).slice(0, 9)
    })
  }

  const quickAmounts = useMemo(() => {
    const rounded = [Math.ceil(net / 10) * 10, Math.ceil(net / 50) * 50, Math.ceil(net / 100) * 100]
    return Array.from(new Set([Math.round(net * 100) / 100, ...rounded])).slice(0, 4)
  }, [net])

  const confirm = async () => {
    setError('')
    if (!credit && method === 'نقدي' && tenderedNum > 0 && tenderedNum < net) {
      return setError('المبلغ المدفوع أقل من الصافي')
    }
    setLoading(true)
    try {
      await onConfirm(credit ? 'آجل' : method, credit ? 'CREDIT' : 'CASH')
    } catch (e: any) {
      setError(e?.message || 'فشل إنشاء الفاتورة')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#e94560]" /> الدفع
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">المطلوب</p>
            <p className="text-3xl font-black text-[#1a1a2e] tabular-nums">{fmt(net)} <span className="text-sm font-bold">ج.م</span></p>
          </div>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          {/* طرق الدفع */}
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); setCredit(false) }}
                className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                  !credit && method === m
                    ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              onClick={() => isWholesale && setCredit(true)}
              disabled={!isWholesale}
              title={!isWholesale ? 'الآجل لعملاء الجملة فقط' : undefined}
              className={`col-span-2 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                credit
                  ? 'bg-yellow-500 text-white border-yellow-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              آجل {!isWholesale && '(لعملاء الجملة فقط)'}
            </button>
          </div>

          {/* كيباد الكاش والباقي */}
          {!credit && method === 'نقدي' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {quickAmounts.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setTendered(String(a))}
                    className="flex-1 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold tabular-nums"
                  >
                    {fmt(a)}
                  </button>
                ))}
              </div>
              <input
                type="text" inputMode="decimal" dir="ltr"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder="المبلغ المدفوع من العميل"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e94560] text-lg font-bold text-center tabular-nums"
              />
              <div className="grid grid-cols-3 gap-2">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    className="py-3 rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-lg font-bold tabular-nums flex items-center justify-center"
                  >
                    {k === '⌫' ? <Delete className="w-5 h-5" /> : k}
                  </button>
                ))}
              </div>
              {tenderedNum > 0 && (
                <div className={`rounded-xl p-3 text-center ${change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-xs font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? 'الباقي للعميل' : 'المدفوع أقل من المطلوب'}
                  </p>
                  <p className={`text-2xl font-black tabular-nums ${change >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(Math.abs(change))} ج.م
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={confirm}
            disabled={loading}
            className="w-full bg-[#e94560] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#c73e54] disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري التسجيل...' : credit ? 'تأكيد البيع آجل' : `تأكيد الدفع — ${fmt(net)} ج.م`}
          </button>
        </div>
      </div>
    </div>
  )
}
