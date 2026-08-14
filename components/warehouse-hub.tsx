'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PackageSearch, Truck, ArrowDownToLine, ArrowUpFromLine, Search,
  ChevronRight, ChevronLeft, Warehouse as WarehouseIcon, PackageOpen, Building2,
  ShoppingCart, Utensils, Wallet, Plus, X, Banknote,
} from 'lucide-react'
import { UnloadOrdersPanel } from '@/components/unload-orders-panel'
import { StocktakeForm } from '@/components/stocktake-form'
import { ExportButtons } from '@/components/export-buttons'

const fmt = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 3 })
const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const PAGE_SIZE = 15

interface StockRow {
  id: string
  name: string
  unit: string
  category: string | null
  stageName: string | null
  minStock: number
  costPrice: number
  sellPrice: number
  wholesalePrice: number
  totalQty: number
  stocks: { warehouseId: string; quantity: number }[]
}
interface SaleRow {
  id: string; saleNo: string; warehouseName: string | null
  buyerType: string; buyerName: string | null; totalAmount: number
  creatorName: string; createdAt: string
  items: { name: string; unit: string; quantity: number; unitPrice: number }[]
}
interface OutgoingRow {
  id: string; outNo: string; warehouseName: string | null
  target: string; costAmount: number; creatorName: string; createdAt: string
  items: { name: string; unit: string; quantity: number; unitCost: number }[]
}
interface WhSettlementRow {
  id: string; settlementNo: string; warehouseName: string | null
  amount: number; status: string; createdByName: string | null; acceptedByName: string | null; createdAt: string
}
interface Movement {
  id: string
  productName: string
  unit: string
  quantity: number
  label: string // source أو target · reason
  createdAt: string
}
interface LoadOrder {
  id: string
  orderNo: string
  delegateName: string
  vehicle: string | null
  warehouseName: string | null
  status: string
  createdAt: string
  items: { name: string; unit: string; quantity: number }[]
  preparedAt: string | null
  preparedByName: string | null
  creatorName: string
  notes: string | null
}
interface UnloadRow {
  id: string
  unloadNo: string
  delegateName: string
  vehicle: string | null
  orderNo: string | null
  warehouseName: string | null
  status: string
  createdAt: string
  confirmedByName: string | null
  items: { name: string; unit: string; quantity: number; kind: string }[]
  notes: string | null
}
interface KeySupplyRow {
  id: string
  supplyNo: string
  accountName: string
  branchName: string
  warehouseName: string | null
  netAmount: number
  creatorName: string
  createdAt: string
  items: { name: string; unit: string; quantity: number; unitPrice: number }[]
}

const LOAD_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'في انتظار استلام المندوب', cls: 'bg-yellow-50 text-yellow-700' },
  IN_PROGRESS: { label: 'العربية في الشارع', cls: 'bg-blue-50 text-blue-700' },
  COMPLETED: { label: 'اتسوّت', cls: 'bg-green-50 text-green-700' },
  CANCELLED: { label: 'ملغية', cls: 'bg-gray-100 text-gray-500' },
}
const UNLOAD_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'في انتظار استلام المخزن', cls: 'bg-yellow-50 text-yellow-700' },
  CONFIRMED: { label: 'المخزن استلم', cls: 'bg-green-50 text-green-700' },
  CANCELLED: { label: 'ملغي', cls: 'bg-gray-100 text-gray-500' },
}

type Tab = 'stock' | 'sell' | 'outgoing' | 'cashbox' | 'loads' | 'unloads' | 'supplies' | 'outs' | 'ins'

export function WarehouseHub({
  stock,
  warehouses,
  categories,
  loads,
  unloads,
  pendingUnloads,
  keySupplies,
  ins,
  outs,
  canEdit,
  stocktakeProducts,
  treasuryBalances,
  sales,
  outgoings,
  settlements,
}: {
  stock: StockRow[]
  warehouses: { id: string; name: string; isDefault: boolean }[]
  categories: string[]
  loads: LoadOrder[]
  unloads: UnloadRow[]
  pendingUnloads: any[]
  keySupplies: KeySupplyRow[]
  ins: Movement[]
  outs: Movement[]
  canEdit: boolean
  stocktakeProducts: { id: string; name: string; unit: string; stocksByWarehouse: Record<string, number> }[]
  treasuryBalances: { warehouseId: string; balance: number }[]
  sales: SaleRow[]
  outgoings: OutgoingRow[]
  settlements: WhSettlementRow[]
}) {
  const [tab, setTab] = useState<Tab>('stock')

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'stock', label: `رصيد الأصناف (${stock.length})`, icon: PackageSearch },
    { key: 'sell', label: 'بيع نقدي', icon: ShoppingCart },
    { key: 'outgoing', label: 'خوارج الشركة', icon: Utensils },
    { key: 'cashbox', label: 'خزنة المخزن', icon: Wallet },
    { key: 'loads', label: `أوامر التحميل (${loads.length})`, icon: Truck },
    { key: 'unloads', label: `أوامر التفريغ (${unloads.length})`, icon: PackageOpen, count: pendingUnloads.length },
    { key: 'supplies', label: `طلبيات كبار الموردين (${keySupplies.length})`, icon: Building2 },
    { key: 'outs', label: 'إذون الصرف', icon: ArrowUpFromLine },
    { key: 'ins', label: 'وارد المخزن', icon: ArrowDownToLine },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              tab === t.key ? 'bg-white text-[#0f3460] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count ? (
              <span className="bg-amber-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'stock' && <StockTab stock={stock} warehouses={warehouses} categories={categories} canEdit={canEdit} stocktakeProducts={stocktakeProducts} />}
      {tab === 'sell' && <SellTab stock={stock} warehouses={warehouses} sales={sales} canEdit={canEdit} />}
      {tab === 'outgoing' && <OutgoingTab stock={stock} warehouses={warehouses} outgoings={outgoings} canEdit={canEdit} />}
      {tab === 'cashbox' && <CashboxTab warehouses={warehouses} treasuryBalances={treasuryBalances} settlements={settlements} canEdit={canEdit} />}
      {tab === 'loads' && <LoadsTab loads={loads} canEdit={canEdit} />}
      {tab === 'unloads' && (
        <div className="space-y-4">
          <UnloadOrdersPanel unloads={pendingUnloads} canEdit={canEdit} />
          <UnloadsHistory unloads={unloads.filter((u) => u.status !== 'PENDING')} />
        </div>
      )}
      {tab === 'supplies' && <KeySuppliesTab supplies={keySupplies} />}
      {tab === 'outs' && <MovementsTab title="خوارج الشركة (إذون الصرف)" movements={outs} negative />}
      {tab === 'ins' && <MovementsTab title="وارد المخزن (إذون الإضافة)" movements={ins} />}
    </div>
  )
}

/* ─── رصيد الأصناف: بحث + فلاتر + صفحات ─── */
function StockTab({ stock, warehouses, categories, canEdit, stocktakeProducts }: {
  stock: StockRow[]
  warehouses: { id: string; name: string; isDefault: boolean }[]
  categories: string[]
  canEdit: boolean
  stocktakeProducts: { id: string; name: string; unit: string; stocksByWarehouse: Record<string, number> }[]
}) {
  const [search, setSearch] = useState('')
  const [warehouseId, setWarehouseId] = useState('') // '' = كل المخازن
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return stock.filter((p) => {
      if (search.trim() && !p.name.includes(search.trim())) return false
      if (category && p.category !== category) return false
      if (warehouseId) {
        const qty = p.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0
        if (qty === 0) return false
      }
      return true
    })
  }, [stock, search, category, warehouseId])

  const qtyOf = (p: StockRow) =>
    warehouseId ? (p.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0) : p.totalQty

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const totalValue = filtered.reduce((s, p) => s + qtyOf(p) * p.costPrice, 0)

  const exportRows = filtered.map((p) => [
    p.name,
    p.category || '—',
    fmt(qtyOf(p)),
    p.unit,
    fmt(p.minStock),
    money(p.costPrice),
    money(qtyOf(p) * p.costPrice),
  ])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
        {/* شريط البحث والفلاتر */}
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30"
              placeholder="بحث باسم الصنف..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            value={warehouseId}
            onChange={(e) => { setWarehouseId(e.target.value); setPage(1) }}
          >
            <option value="">كل المخازن</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1) }}
          >
            <option value="">كل الفئات</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ExportButtons
            fileName="جرد-المخزن"
            headers={['الصنف', 'الفئة', 'الكمية', 'الوحدة', 'الحد الأدنى', 'تكلفة الوحدة', 'قيمة الرصيد']}
            rows={exportRows}
          />
        </div>

        <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 bg-gray-50/50">
          <span>{filtered.length} صنف {warehouseId ? `في ${warehouses.find((w) => w.id === warehouseId)?.name}` : 'في كل المخازن'}</span>
          <span>قيمة الرصيد المعروض: <b className="text-[#1a1a2e] tabular-nums">{money(totalValue)} ج.م</b></span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">الصنف</th>
                <th className="p-3 font-medium">الفئة</th>
                <th className="p-3 font-medium">الكمية</th>
                <th className="p-3 font-medium">الحد الأدنى</th>
                <th className="p-3 font-medium">تكلفة الوحدة</th>
                <th className="p-3 font-medium">قيمة الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش أصناف مطابقة للبحث/الفلتر.</td></tr>
              )}
              {pageRows.map((p) => {
                const qty = qtyOf(p)
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-semibold">
                      {p.name}
                      {!warehouseId && p.stocks.filter((s) => s.quantity !== 0).length > 0 && (
                        <p className="text-[11px] text-gray-400 font-normal mt-0.5">
                          {p.stocks.filter((s) => s.quantity !== 0).map((s) => `${warehouses.find((w) => w.id === s.warehouseId)?.name}: ${fmt(s.quantity)}`).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      {p.category
                        ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{p.category}</span>
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="p-3">
                      <span className={`font-bold tabular-nums ${qty <= p.minStock ? 'text-red-600' : 'text-[#1a1a2e]'}`}>
                        {fmt(qty)} {p.unit}
                      </span>
                      {qty <= p.minStock && (
                        <span className="mr-2 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">تحت الحد</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-500 tabular-nums">{fmt(p.minStock)}</td>
                    <td className="p-3 text-gray-500 tabular-nums">{money(p.costPrice)}</td>
                    <td className="p-3 font-semibold tabular-nums">{money(qty * p.costPrice)} ج.م</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* الصفحات */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 p-4 border-t border-gray-100">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
              .map((n, idx, arr) => (
                <span key={n} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== n - 1 && <span className="px-1 text-gray-400">…</span>}
                  <button
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold ${n === safePage ? 'bg-[#0f3460] text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                  >
                    {n}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4 no-print">
        {canEdit && (
          <StocktakeForm products={stocktakeProducts} warehouses={warehouses} />
        )}
      </div>
    </div>
  )
}

/* ─── أوامر التحميل ─── */
function LoadsTab({ loads, canEdit }: { loads: LoadOrder[]; canEdit: boolean }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const prepare = async (id: string) => {
    setBusyId(id)
    setError('')
    const res = await fetch(`/api/delivery-orders/${id}/prepare`, { method: 'POST' })
    setBusyId(null)
    if (!res.ok) { setError((await res.json()).error || 'فشل تسجيل التجهيز'); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3">
        <Truck className="w-5 h-5 text-[#0f3460]" />
        <h3 className="text-base font-bold text-[#1a1a2e]">أوامر تحميل العربيات</h3>
      </div>
      <p className="text-xs text-gray-400 px-5 pb-2">دوس على أي أمر عشان تفتح تفاصيله كاملة وتأكد التجهيز منها</p>
      {error && <div className="mx-5 mb-2 bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
      <div className="divide-y divide-gray-50">
        {loads.length === 0 && <p className="p-6 text-center text-gray-500 text-sm">مفيش أوامر تحميل.</p>}
        {loads.map((o) => {
          const st = LOAD_STATUS[o.status] || LOAD_STATUS.PENDING
          const open = openId === o.id
          const needsPrep = o.status === 'PENDING' || o.preparedAt
          return (
            <div key={o.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : o.id)}
                className="w-full text-right p-4 px-5 hover:bg-gray-50/60 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-sm text-[#1a1a2e] tabular-nums flex items-center gap-1.5">
                    {open ? <ChevronLeft className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    {o.orderNo}
                    <span className="font-normal text-gray-500"> — مندوب: {o.delegateName}{o.vehicle ? ` · عربية ${o.vehicle}` : ''}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {needsPrep && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${o.preparedAt ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                        {o.preparedAt ? 'المخزن جهّز ✓' : 'مستني التجهيز'}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${st.cls}`}>{st.label}</span>
                    <span className="text-xs text-gray-400 tabular-nums">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
              </button>

              {open && (
                <div className="px-5 pb-4 -mt-1">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
                    {/* بيانات الأمر كاملة */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div><span className="text-gray-400">رقم الأمر</span><p className="font-semibold text-[#1a1a2e] tabular-nums">{o.orderNo}</p></div>
                      <div><span className="text-gray-400">المندوب</span><p className="font-semibold text-[#1a1a2e]">{o.delegateName}</p></div>
                      <div><span className="text-gray-400">العربية</span><p className="font-semibold text-[#1a1a2e]">{o.vehicle || '—'}</p></div>
                      <div><span className="text-gray-400">مخزن التحميل</span><p className="font-semibold text-[#1a1a2e]">{o.warehouseName || '—'}</p></div>
                      <div><span className="text-gray-400">أمر بواسطة</span><p className="font-semibold text-[#1a1a2e]">{o.creatorName}</p></div>
                      <div><span className="text-gray-400">التاريخ</span><p className="font-semibold text-[#1a1a2e] tabular-nums">{new Date(o.createdAt).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
                    </div>
                    {o.notes && (
                      <p className="text-xs bg-white rounded-lg p-2.5 border border-gray-100"><span className="text-gray-400">ملاحظات: </span>{o.notes}</p>
                    )}

                    {/* الأصناف كاملة بالجدول */}
                    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-right">
                            <th className="p-2 font-medium">#</th>
                            <th className="p-2 font-medium">الصنف</th>
                            <th className="p-2 font-medium">الكمية المحمّلة</th>
                            <th className="p-2 font-medium">الوحدة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.items.map((it, i) => (
                            <tr key={i} className="border-t border-gray-50">
                              <td className="p-2 text-gray-400 tabular-nums">{i + 1}</td>
                              <td className="p-2 font-semibold text-[#1a1a2e]">{it.name}</td>
                              <td className="p-2 tabular-nums font-semibold">{fmt(it.quantity)}</td>
                              <td className="p-2 text-gray-500">{it.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* موقف تجهيز المخزن — منفصل عن موقف استلام المندوب، وذو معنى بس لحد ما المندوب يستلم */}
                    {needsPrep && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {o.preparedAt ? (
                          <span className="text-xs font-semibold text-green-600">
                            ✓ اتجهز{o.preparedByName ? ` — ${o.preparedByName}` : ''} · {new Date(o.preparedAt).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600">لسه بيتجهز في المخزن</span>
                        )}
                        {canEdit && o.status === 'PENDING' && !o.preparedAt && (
                          <button
                            onClick={() => prepare(o.id)}
                            disabled={busyId === o.id}
                            className="px-4 py-2 rounded-lg bg-[#0f3460] text-white text-xs font-bold hover:bg-[#0a2545] disabled:opacity-50"
                          >
                            {busyId === o.id ? 'جارٍ الحفظ...' : 'تم التجهيز'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── سجل أوامر التفريغ المنتهية ─── */
function UnloadsHistory({ unloads }: { unloads: UnloadRow[] }) {
  if (unloads.length === 0) return null
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 pb-3">
        <h3 className="text-base font-bold text-[#1a1a2e]">سجل أوامر التفريغ</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {unloads.map((u) => {
          const st = UNLOAD_STATUS[u.status] || UNLOAD_STATUS.PENDING
          return (
            <div key={u.id} className="p-4 px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-sm text-[#1a1a2e] tabular-nums">
                  {u.unloadNo}
                  <span className="font-normal text-gray-500"> — مندوب: {u.delegateName}{u.vehicle ? ` · عربية ${u.vehicle}` : ''}{u.orderNo ? ` · جولة ${u.orderNo}` : ''}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${st.cls}`}>{st.label}{u.confirmedByName ? ` — ${u.confirmedByName}` : ''}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{new Date(u.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {u.items.map((it, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded tabular-nums ${it.kind === 'RETURN' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                    {it.name} {fmt(it.quantity)} {it.unit} — {it.kind === 'RETURN' ? 'مرتجع عميل' : 'بواقي بيع'}
                  </span>
                ))}
              </div>
              {u.notes && <p className="text-[11px] text-gray-500 mt-2 whitespace-pre-line">{u.notes}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── طلبيات كبار الموردين — حركات الصرف لفروع بيوت الجملة ─── */
function KeySuppliesTab({ supplies }: { supplies: KeySupplyRow[] }) {
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState('')
  const q = search.trim()
  const filtered = supplies.filter(
    (s) =>
      !q ||
      s.supplyNo.includes(q) ||
      s.accountName.includes(q) ||
      s.branchName.includes(q) ||
      s.items.some((it) => it.name.includes(q))
  )

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#0f3460]" />
          طلبيات كبار الموردين ({filtered.length})
        </h3>
        <div className="relative w-64 max-w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30"
            placeholder="بحث برقم الطلبية أو العميل أو الفرع أو الصنف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
        {filtered.length === 0 && <p className="p-6 text-center text-gray-500 text-sm">مفيش طلبيات.</p>}
        {filtered.map((s) => {
          const open = openId === s.id
          return (
            <div key={s.id}>
              <button
                onClick={() => setOpenId(open ? '' : s.id)}
                className="w-full text-right p-3.5 px-5 flex justify-between items-start hover:bg-gray-50/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#1a1a2e] tabular-nums">
                    {s.supplyNo}
                    <span className="font-normal text-gray-500"> — {s.accountName} · فرع {s.branchName}{s.warehouseName ? ` · من ${s.warehouseName}` : ''}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.items.length} صنف · بواسطة {s.creatorName}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-sm text-[#0f3460] tabular-nums">{money(s.netAmount)} ج.م</span>
                  <span className="text-xs text-gray-400 tabular-nums">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</span>
                  {open ? <ChevronLeft className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400 rotate-180" />}
                </div>
              </button>
              {open && (
                <div className="px-5 pb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {s.items.map((it, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded font-semibold tabular-nums bg-blue-50 text-blue-700">
                        {it.name} {fmt(it.quantity)} {it.unit} × {money(it.unitPrice)} ج.م
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── خوارج الشركة / وارد المخزن ─── */
function MovementsTab({ title, movements, negative = false }: { title: string; movements: Movement[]; negative?: boolean }) {
  const [search, setSearch] = useState('')
  const filtered = movements.filter((m) => !search.trim() || m.productName.includes(search.trim()) || m.label.includes(search.trim()))

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
          {negative ? <ArrowUpFromLine className="w-5 h-5 text-red-500" /> : <ArrowDownToLine className="w-5 h-5 text-green-600" />}
          {title}
        </h3>
        <div className="relative w-64 max-w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30"
            placeholder="بحث بالصنف أو الجهة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
        {filtered.length === 0 && <p className="p-6 text-center text-gray-500 text-sm">مفيش حركات.</p>}
        {filtered.map((m) => (
          <div key={m.id} className="p-3.5 px-5 flex justify-between items-start">
            <div className="min-w-0">
              <p className={`font-semibold text-sm tabular-nums ${negative ? 'text-red-600' : 'text-green-700'}`}>
                {negative ? '-' : '+'}{fmt(m.quantity)} {m.unit} — {m.productName}
              </p>
              <p className="text-xs text-gray-400 truncate">{m.label}</p>
            </div>
            <span className="text-xs text-gray-400 tabular-nums shrink-0">
              {new Date(m.createdAt).toLocaleDateString('ar-EG')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── بيع نقدي مباشر من المخزن ─── */
const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f3460] text-sm bg-white'

function stockAt(row: StockRow, warehouseId: string) {
  return row.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0
}

function SellTab({ stock, warehouses, sales, canEdit }: { stock: StockRow[]; warehouses: { id: string; name: string; isDefault: boolean }[]; sales: SaleRow[]; canEdit: boolean }) {
  const router = useRouter()
  const defaultWh = warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ''
  const [warehouseId, setWarehouseId] = useState(defaultWh)
  const [buyerType, setBuyerType] = useState<'CUSTOMER' | 'TRADER'>('CUSTOMER')
  const [buyerName, setBuyerName] = useState('')
  const [lines, setLines] = useState<{ productId: string; quantity: string }[]>([{ productId: '', quantity: '' }])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const available = stock.filter((s) => stockAt(s, warehouseId) > 0)
  // السعر بيتحدد تلقائي: عميل ← قطاعي، تاجر ← جملة (من بنك الأصناف) — مش من إدخال المستخدم
  const priceOf = (productId: string) => {
    const p = stock.find((s) => s.id === productId)
    if (!p) return 0
    return buyerType === 'TRADER' ? (p.wholesalePrice || p.sellPrice || 0) : (p.sellPrice || 0)
  }
  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * priceOf(l.productId), 0)

  const setLine = (i: number, field: string, value: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [field]: value } : l)))
  const pickProduct = (i: number, productId: string) => setLines(lines.map((l, j) => (j === i ? { ...l, productId } : l)))
  const addLine = () => setLines([...lines, { productId: '', quantity: '' }])
  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i))

  const submit = async () => {
    setError('')
    const items = lines.filter((l) => l.productId && Number(l.quantity) > 0)
    if (!warehouseId) return setError('اختار المخزن')
    if (items.length === 0) return setError('أضف صنف واحد على الأقل بكمية')
    setLoading(true)
    const res = await fetch('/api/warehouse/sales', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId, buyerType, buyerName, notes, items }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) return setError(data.error || 'حصل خطأ')
    setLines([{ productId: '', quantity: '' }]); setBuyerName(''); setNotes('')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 space-y-3 border border-gray-100">
          <h3 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-[#0f3460]" /> بيع نقدي من المخزن</h3>
          <p className="text-[11px] text-gray-400">السعر بيتحدد تلقائي من بنك الأصناف: عميل ← قطاعي، تاجر ← جملة (مش بيتكتب باليد).</p>
          {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={buyerType} onChange={(e) => setBuyerType(e.target.value as any)} className={inputCls}>
              <option value="CUSTOMER">عميل</option>
              <option value="TRADER">تاجر</option>
            </select>
            <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder={buyerType === 'TRADER' ? 'اسم التاجر (اختياري)' : 'اسم العميل (اختياري)'} className={inputCls} />
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const avail = l.productId ? stockAt(stock.find((s) => s.id === l.productId)!, warehouseId) : 0
              return (
                <div key={i} className="flex gap-2 items-center">
                  <select value={l.productId} onChange={(e) => pickProduct(i, e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">اختار الصنف</option>
                    {available.map((p) => <option key={p.id} value={p.id}>{p.name} (متاح {fmt(stockAt(p, warehouseId))})</option>)}
                  </select>
                  <input type="text" inputMode="decimal" dir="ltr" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} placeholder="كمية" className="w-24 px-3 py-2.5 border border-gray-200 rounded-xl text-sm tabular-nums" />
                  <div className="w-28 shrink-0 px-3 py-2.5 rounded-xl text-sm tabular-nums bg-gray-50 border border-gray-100 text-gray-600 text-center" title={buyerType === 'TRADER' ? 'سعر الجملة' : 'سعر القطاعي'}>
                    {l.productId ? `${money(priceOf(l.productId))}` : 'السعر'}
                  </div>
                  {lines.length > 1 && <button onClick={() => removeLine(i)} className="p-1.5 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
                  {l.productId && Number(l.quantity) > avail && <span className="text-[10px] text-red-500 whitespace-nowrap">أكبر من المتاح</span>}
                </div>
              )
            })}
            <button onClick={addLine} className="flex items-center gap-1 text-xs text-[#0f3460] font-semibold hover:text-[#0a2545]"><Plus className="w-3.5 h-3.5" /> إضافة صنف</button>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">الإجمالي</span>
            <span className="text-lg font-bold text-[#0f3460] tabular-nums">{money(total)} ج.م</span>
          </div>
          <button onClick={submit} disabled={loading || total <= 0} className="w-full bg-[#0f3460] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50">
            {loading ? 'جاري...' : 'تسجيل البيع (الكاش يدخل خزنة المخزن)'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-sm text-[#1a1a2e]">آخر المبيعات النقدية</h3></div>
        {sales.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">لا يوجد مبيعات بعد</p> : (
          <div className="divide-y divide-gray-50">
            {sales.map((s) => (
              <div key={s.id} className="p-3 sm:px-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-xs text-[#0f3460] tabular-nums">{s.saleNo} <span className="text-gray-400 font-normal">· {s.buyerType === 'TRADER' ? 'تاجر' : 'عميل'}{s.buyerName ? ` (${s.buyerName})` : ''}</span></p>
                  <p className="text-[11px] text-gray-500 truncate">{s.items.map((it) => `${it.name} ×${fmt(it.quantity)}`).join('، ')}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="font-bold text-sm text-green-700 tabular-nums">{money(s.totalAmount)} ج.م</p>
                  <p className="text-[10px] text-gray-400 tabular-nums">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── خوارج الشركة (استهلاك داخلي: بوفيه/موظفين) ─── */
const OUT_TARGETS = ['بوفيه', 'موظفين']
function OutgoingTab({ stock, warehouses, outgoings, canEdit }: { stock: StockRow[]; warehouses: { id: string; name: string; isDefault: boolean }[]; outgoings: OutgoingRow[]; canEdit: boolean }) {
  const router = useRouter()
  const defaultWh = warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ''
  const [warehouseId, setWarehouseId] = useState(defaultWh)
  const [target, setTarget] = useState('بوفيه')
  const [customTarget, setCustomTarget] = useState('')
  const [lines, setLines] = useState<{ productId: string; quantity: string }[]>([{ productId: '', quantity: '' }])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const available = stock.filter((s) => stockAt(s, warehouseId) > 0)
  const totalCost = lines.reduce((sum, l) => { const p = stock.find((s) => s.id === l.productId); return sum + (Number(l.quantity) || 0) * (p?.costPrice || 0) }, 0)
  const setLine = (i: number, field: string, value: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [field]: value } : l)))
  const addLine = () => setLines([...lines, { productId: '', quantity: '' }])
  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i))

  const submit = async () => {
    setError('')
    const finalTarget = target === 'أخرى' ? customTarget.trim() : target
    const items = lines.filter((l) => l.productId && Number(l.quantity) > 0)
    if (!finalTarget) return setError('اكتب جهة الصرف')
    if (items.length === 0) return setError('أضف صنف واحد على الأقل بكمية')
    setLoading(true)
    const res = await fetch('/api/warehouse/outgoings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId, target: finalTarget, notes, items }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) return setError(data.error || 'حصل خطأ')
    setLines([{ productId: '', quantity: '' }]); setNotes(''); setCustomTarget('')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 space-y-3 border border-gray-100">
          <h3 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-2"><Utensils className="w-4 h-4 text-[#0f3460]" /> خوارج الشركة (استهلاك داخلي)</h3>
          <p className="text-[11px] text-gray-400">بيتخصم من المخزون ويتسجّل كمصروف بالتكلفة — من غير أي أثر على الخزنة.</p>
          {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
              {OUT_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="أخرى">أخرى...</option>
            </select>
            {target === 'أخرى' && <input value={customTarget} onChange={(e) => setCustomTarget(e.target.value)} placeholder="اكتب جهة الصرف" className={inputCls} />}
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const avail = l.productId ? stockAt(stock.find((s) => s.id === l.productId)!, warehouseId) : 0
              return (
                <div key={i} className="flex gap-2 items-center">
                  <select value={l.productId} onChange={(e) => setLine(i, 'productId', e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">اختار الصنف</option>
                    {available.map((p) => <option key={p.id} value={p.id}>{p.name} (متاح {fmt(stockAt(p, warehouseId))})</option>)}
                  </select>
                  <input type="text" inputMode="decimal" dir="ltr" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} placeholder="كمية" className="w-24 px-3 py-2.5 border border-gray-200 rounded-xl text-sm tabular-nums" />
                  {lines.length > 1 && <button onClick={() => removeLine(i)} className="p-1.5 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
                  {l.productId && Number(l.quantity) > avail && <span className="text-[10px] text-red-500 whitespace-nowrap">أكبر من المتاح</span>}
                </div>
              )
            })}
            <button onClick={addLine} className="flex items-center gap-1 text-xs text-[#0f3460] font-semibold hover:text-[#0a2545]"><Plus className="w-3.5 h-3.5" /> إضافة صنف</button>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">تكلفة الاستهلاك</span>
            <span className="text-lg font-bold text-orange-700 tabular-nums">{money(totalCost)} ج.م</span>
          </div>
          <button onClick={submit} disabled={loading} className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-orange-700 disabled:opacity-50">
            {loading ? 'جاري...' : 'تسجيل الخوارج'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-sm text-[#1a1a2e]">آخر الخوارج</h3></div>
        {outgoings.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">لا يوجد خوارج بعد</p> : (
          <div className="divide-y divide-gray-50">
            {outgoings.map((o) => (
              <div key={o.id} className="p-3 sm:px-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-xs text-orange-700 tabular-nums">{o.outNo} <span className="text-gray-400 font-normal">· {o.target}</span></p>
                  <p className="text-[11px] text-gray-500 truncate">{o.items.map((it) => `${it.name} ×${fmt(it.quantity)}`).join('، ')}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="font-bold text-sm text-orange-700 tabular-nums">{money(o.costAmount)} ج.م</p>
                  <p className="text-[10px] text-gray-400 tabular-nums">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── خزنة المخزن + التسوية ─── */
const SETTLE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'في انتظار اعتماد أمين الخزنة', cls: 'bg-yellow-50 text-yellow-700' },
  ACCEPTED: { label: 'اتقبلت', cls: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'اترفضت', cls: 'bg-red-50 text-red-600' },
}
function CashboxTab({ warehouses, treasuryBalances, settlements, canEdit }: { warehouses: { id: string; name: string; isDefault: boolean }[]; treasuryBalances: { warehouseId: string; balance: number }[]; settlements: WhSettlementRow[]; canEdit: boolean }) {
  const router = useRouter()
  const balMap = Object.fromEntries(treasuryBalances.map((t) => [t.warehouseId, t.balance]))
  const withBalance = warehouses.filter((w) => (balMap[w.id] ?? 0) !== 0 || treasuryBalances.some((t) => t.warehouseId === w.id))
  const defaultWh = withBalance[0]?.id || warehouses[0]?.id || ''
  const [warehouseId, setWarehouseId] = useState(defaultWh)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentBalance = balMap[warehouseId] ?? 0

  const submit = async () => {
    setError('')
    if (!(Number(amount) > 0)) return setError('اكتب المبلغ المسلَّم')
    setLoading(true)
    const res = await fetch('/api/warehouse/settlements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId, amount, notes }),
    })
    const data = await res.json(); setLoading(false)
    if (!res.ok) return setError(data.error || 'حصل خطأ')
    setAmount(''); setNotes('')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* أرصدة خزائن المخازن */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {treasuryBalances.length === 0 && <p className="col-span-full text-center text-gray-400 text-sm py-4">لسه مفيش خزنة مخزن — أول بيع نقدي بيفتح الخزنة تلقائي</p>}
        {treasuryBalances.map((t) => {
          const wh = warehouses.find((w) => w.id === t.warehouseId)
          return (
            <div key={t.warehouseId} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-[#0f3460]" /><span className="text-xs text-gray-500 truncate">{wh?.name || 'مخزن'}</span></div>
              <p className="text-xl font-bold text-[#0f3460] tabular-nums">{money(t.balance)} <span className="text-xs font-normal text-gray-400">ج.م</span></p>
            </div>
          )
        })}
      </div>

      {canEdit && (
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 space-y-3 border border-gray-100">
          <h3 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-2"><Banknote className="w-4 h-4 text-[#0f3460]" /> تسوية خزنة المخزن مع العمومية</h3>
          <p className="text-[11px] text-gray-400">أمين المخزن بيسلّم الكاش، وأمين الخزنة العمومية بيعتمد التسوية فتتنقل الفلوس — زي المندوب.</p>
          {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} — رصيد {money(balMap[w.id] ?? 0)} ج.م</option>)}
            </select>
            <input type="text" inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`المبلغ المسلَّم (رصيد ${money(currentBalance)})`} className={inputCls} />
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className={inputCls} />
          <button onClick={submit} disabled={loading || !(Number(amount) > 0)} className="w-full bg-[#0f3460] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50">
            {loading ? 'جاري...' : 'تقديم التسوية'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-sm text-[#1a1a2e]">تسويات خزنة المخزن</h3></div>
        {settlements.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">لا يوجد تسويات بعد</p> : (
          <div className="divide-y divide-gray-50">
            {settlements.map((s) => {
              const st = SETTLE_STATUS[s.status] || SETTLE_STATUS.PENDING
              return (
                <div key={s.id} className="p-3 sm:px-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-[#0f3460] tabular-nums">{s.settlementNo} <span className="text-gray-400 font-normal">· {s.warehouseName || 'مخزن'}</span></p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="font-bold text-sm text-[#0f3460] tabular-nums">{money(s.amount)} ج.م</p>
                    <p className="text-[10px] text-gray-400 tabular-nums">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
