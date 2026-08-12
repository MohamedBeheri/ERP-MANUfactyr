import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Factory, TrendingDown, Boxes, Flame, AlertTriangle, PackageCheck, Warehouse as WarehouseIcon, Coins } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, hasSectionAccess } from '@/lib/permissions'
import { PeriodSelector } from '@/components/period-selector'
import { GroupBarChart } from '@/components/group-charts'
import { ProductionTrendChart } from '@/components/dashboard-charts'

export const dynamic = 'force-dynamic'

const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })
const kg = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} كجم`

function buildPeriod(sp: { days?: string; from?: string; to?: string }) {
  if (sp.from && sp.to) {
    const from = new Date(sp.from); from.setHours(0, 0, 0, 0)
    const to = new Date(sp.to); to.setHours(23, 59, 59, 999)
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
    return { from, to, days }
  }
  const days = Math.min(90, Math.max(1, Number(sp.days) || 7))
  const from = new Date(); from.setDate(from.getDate() - (days - 1)); from.setHours(0, 0, 0, 0)
  const to = new Date(); to.setHours(23, 59, 59, 999)
  return { from, to, days }
}

// لوحة تحكم التصنيع والمخازن: إنتاج + هدر + أرصدة المخازن + أصناف تحت الحد
export default async function FactoryDashboardPage({ searchParams: raw }: { searchParams: Promise<{ days?: string; from?: string; to?: string }> }) {
  const sp = await raw
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!hasSectionAccess(perms, 'factory') && !hasSectionAccess(perms, 'warehouse')) redirect('/dashboard')

  const { from, to, days } = buildPeriod(sp)
  const period = { gte: from, lte: to }

  const [productions, warehouses, products, purchasesInStock] = await Promise.all([
    prisma.production.findMany({ where: { createdAt: period }, orderBy: { createdAt: 'asc' } }),
    prisma.warehouse.findMany({ where: { isActive: true }, include: { stocks: { include: { product: { select: { costPrice: true } } } } }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true, minStock: true, quantity: true, costPrice: true } }),
    prisma.purchase.count({ where: { createdAt: period } }),
  ])

  // KPIs الإنتاج
  const totalInput = productions.reduce((s, p) => s + Number(p.inputWeight), 0) / 1000
  const totalOutput = productions.reduce((s, p) => s + Number(p.outputWeight), 0) / 1000
  const totalWaste = productions.reduce((s, p) => s + Number(p.wasteWeight), 0) / 1000
  const wastePct = totalInput > 0 ? (totalWaste / totalInput) * 100 : 0
  const opCost = productions.reduce((s, p) => s + Number(p.opCost), 0)
  const batchCount = productions.length

  // قيمة المخزون الكلية + قيمة كل مخزن
  const warehouseValues = warehouses.map((w) => ({
    label: w.name,
    value: w.stocks.reduce((s, st) => s + Number(st.quantity) * Number(st.product.costPrice), 0),
  })).filter((w) => w.value > 0).sort((a, b) => b.value - a.value)
  const totalStockValue = warehouseValues.reduce((s, w) => s + w.value, 0)

  // أصناف تحت الحد الأدنى
  const lowStock = products.filter((p) => Number(p.minStock) > 0 && Number(p.quantity) <= Number(p.minStock))
  const lowStockList = lowStock.map((p) => ({ label: p.name, value: Number(p.quantity) })).sort((a, b) => a.value - b.value).slice(0, 10)

  // اتجاه الإنتاج اليومي
  const dayKey = (d: Date) => d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
  const dayLabels: string[] = []
  const producedByDay: number[] = []
  const ordersByDay: number[] = []
  const cursor = new Date(from)
  for (let i = 0; i < days; i++) {
    dayLabels.push(dayKey(cursor))
    const ds = new Date(cursor); ds.setHours(0, 0, 0, 0)
    const de = new Date(cursor); de.setHours(23, 59, 59, 999)
    const dayProds = productions.filter((p) => p.createdAt >= ds && p.createdAt <= de)
    producedByDay.push(dayProds.reduce((s, p) => s + Number(p.outputWeight), 0) / 1000)
    ordersByDay.push(dayProds.length)
    cursor.setDate(cursor.getDate() + 1)
  }

  // أعلى مراحل الهدر
  const wasteByStage = new Map<string, number>()
  for (const p of productions) wasteByStage.set(p.stage, (wasteByStage.get(p.stage) || 0) + Number(p.wasteWeight) / 1000)
  const wasteList = Array.from(wasteByStage.entries()).map(([label, value]) => ({ label, value })).filter((w) => w.value > 0).sort((a, b) => b.value - a.value)

  const kpis = [
    { label: 'تشغيلات الإنتاج', value: fmt(batchCount), Icon: Factory, cls: 'text-[#0f3460]', bg: 'bg-blue-50' },
    { label: 'وزن الناتج', value: kg(totalOutput), Icon: PackageCheck, cls: 'text-green-700', bg: 'bg-green-50' },
    { label: 'إجمالي الهدر', value: `${kg(totalWaste)} (${wastePct.toFixed(1)}%)`, Icon: TrendingDown, cls: wastePct > 20 ? 'text-red-600' : 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'تكلفة التشغيل', value: egp(opCost), Icon: Coins, cls: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'قيمة المخزون الكلية', value: egp(totalStockValue), Icon: Boxes, cls: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'عدد المخازن', value: fmt(warehouses.length), Icon: WarehouseIcon, cls: 'text-sky-700', bg: 'bg-sky-50' },
    { label: 'أصناف تحت الحد الأدنى', value: fmt(lowStock.length), Icon: AlertTriangle, cls: lowStock.length > 0 ? 'text-red-600' : 'text-green-700', bg: 'bg-red-50' },
    { label: 'أوامر شراء بالفترة', value: fmt(purchasesInStock), Icon: Flame, cls: 'text-purple-700', bg: 'bg-purple-50' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">لوحة تحكم التصنيع والمخازن</h1>
          <p className="text-sm text-gray-500 mt-0.5">متابعة الإنتاج والهدر وأرصدة المخازن برسومات وفلتر فترة</p>
        </div>
        <PeriodSelector current={sp.from && sp.to ? 0 : days} basePath="/factory/dashboard" theme="light" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}><k.Icon className={`w-5 h-5 ${k.cls}`} /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500">{k.label}</p>
              <p className={`text-base font-bold tabular-nums ${k.cls}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <ProductionTrendChart labels={dayLabels} produced={producedByDay} orders={ordersByDay} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <GroupBarChart title="قيمة المخزون حسب المخزن" subtitle="تكلفة الأصناف في كل مخزن" items={warehouseValues} color="#6366f1" emptyText="مفيش أرصدة" />
        <GroupBarChart title="الهدر حسب المرحلة" subtitle="إجمالي الهدر (كجم) لكل مرحلة إنتاج في الفترة" items={wasteList} color="#ef4444" money={false} emptyText="مفيش هدر مسجّل في الفترة" />
      </div>

      <GroupBarChart title="أصناف تحت الحد الأدنى — تحتاج توريد" subtitle="أقل الأصناف رصيدًا (وصلت أو نزلت تحت حد الأمان)" items={lowStockList} color="#f59e0b" money={false} emptyText="كل الأصناف فوق الحد الأدنى ✓" />
    </div>
  )
}
