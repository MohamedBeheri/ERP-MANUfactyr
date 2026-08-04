'use client'

import { useMemo, useState } from 'react'
import {
  PackageSearch, Truck, ArrowDownToLine, ArrowUpFromLine, Search,
  ChevronRight, ChevronLeft, Warehouse as WarehouseIcon, PackageOpen,
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
  totalQty: number
  stocks: { warehouseId: string; quantity: number }[]
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

type Tab = 'stock' | 'loads' | 'unloads' | 'outs' | 'ins'

export function WarehouseHub({
  stock,
  warehouses,
  categories,
  loads,
  unloads,
  pendingUnloads,
  ins,
  outs,
  canEdit,
  stocktakeProducts,
}: {
  stock: StockRow[]
  warehouses: { id: string; name: string; isDefault: boolean }[]
  categories: string[]
  loads: LoadOrder[]
  unloads: UnloadRow[]
  pendingUnloads: any[]
  ins: Movement[]
  outs: Movement[]
  canEdit: boolean
  stocktakeProducts: { id: string; name: string; unit: string; stocksByWarehouse: Record<string, number> }[]
}) {
  const [tab, setTab] = useState<Tab>('stock')

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'stock', label: `رصيد الأصناف (${stock.length})`, icon: PackageSearch },
    { key: 'loads', label: `أوامر التحميل (${loads.length})`, icon: Truck },
    { key: 'unloads', label: `أوامر التفريغ (${unloads.length})`, icon: PackageOpen, count: pendingUnloads.length },
    { key: 'outs', label: 'خوارج الشركة', icon: ArrowUpFromLine },
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
      {tab === 'loads' && <LoadsTab loads={loads} />}
      {tab === 'unloads' && (
        <div className="space-y-4">
          <UnloadOrdersPanel unloads={pendingUnloads} canEdit={canEdit} />
          <UnloadsHistory unloads={unloads.filter((u) => u.status !== 'PENDING')} />
        </div>
      )}
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
function LoadsTab({ loads }: { loads: LoadOrder[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3">
        <Truck className="w-5 h-5 text-[#0f3460]" />
        <h3 className="text-base font-bold text-[#1a1a2e]">أوامر تحميل العربيات</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {loads.length === 0 && <p className="p-6 text-center text-gray-500 text-sm">مفيش أوامر تحميل.</p>}
        {loads.map((o) => {
          const st = LOAD_STATUS[o.status] || LOAD_STATUS.PENDING
          return (
            <div key={o.id} className="p-4 px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-sm text-[#1a1a2e] tabular-nums">
                  {o.orderNo}
                  <span className="font-normal text-gray-500"> — مندوب: {o.delegateName}{o.vehicle ? ` · عربية ${o.vehicle}` : ''}{o.warehouseName ? ` · من ${o.warehouseName}` : ''}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${st.cls}`}>{st.label}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {o.items.map((it, i) => (
                  <span key={i} className="text-xs bg-gray-50 text-gray-700 px-2 py-0.5 rounded tabular-nums">
                    {it.name} {fmt(it.quantity)} {it.unit}
                  </span>
                ))}
              </div>
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
