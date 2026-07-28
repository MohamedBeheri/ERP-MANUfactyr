import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Printer, Flame, ShoppingBag, TrendingDown, Package2, Factory, Wheat, Package, Activity, ArrowLeft, ChevronDown } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ensureStockStages } from '@/lib/stock-stages'
import { RecipeManager } from '@/components/recipe-manager'

export const dynamic = 'force-dynamic'

const num = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 1 })

export default async function FactoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canAdd = canDoAction(perms, 'factory', 'add')
  const canEdit = canDoAction(perms, 'factory', 'edit')
  const canDelete = canDoAction(perms, 'factory', 'delete')

  await ensureStockStages()

  const [productions, products, operations, warehouses, recipes] = await Promise.all([
    prisma.production.findMany({
      include: {
        items: { include: { product: true } },
        inputs: { include: { product: true } },
        rawProduct: true,
        recipe: true,
        creator: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.productionOperation.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { inputStage: true, outputStage: true },
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.recipe.findMany({
      where: { isActive: true },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const rawProducts = products.filter((p) => p.type === 'RAW')

  const roastingOrders = productions.filter((p) => p.lineType === 'ROASTING')
  const totalInput = productions.reduce((s, p) => s + p.inputWeight, 0)
  const totalOutput = productions.reduce((s, p) => s + p.outputWeight, 0)
  const totalWaste = productions.reduce((s, p) => s + p.wasteWeight, 0)
  const avgRoastWaste =
    roastingOrders.length > 0
      ? roastingOrders.reduce((s, p) => s + Number(p.wastePercent), 0) / roastingOrders.length
      : 0
  const yieldPct = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0

  const recipeLite = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    lineType: r.lineType,
    outputName: r.outputName,
    roastLevel: r.roastLevel,
    grindType: r.grindType,
    expectedWaste: Number(r.expectedWaste),
    notes: r.notes,
    items: r.items.map((it) => ({ productId: it.productId, percentage: Number(it.percentage), productName: it.product.name })),
  }))

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">المصنع</h1>
          <p className="text-sm text-gray-500 mt-0.5">إدارة خطوط الإنتاج والوصفات ومتابعة الهدر</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {canAdd && (
            <Link href="/factory/produce" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-[#e9b44c] to-[#d9a43c] text-[#1a1a2e] rounded-xl text-sm font-bold hover:shadow-md transition-shadow">
              <Factory className="w-4 h-4" />
              أمر تصنيع
            </Link>
          )}
          <Link href="/factory/reconciliation" className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-gray-200 text-[#0f3460] rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
            محضر تشغيل
          </Link>
        </div>
      </div>

      {/* ===== KPIs + Quick Links ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Package2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#1a1a2e] tabular-nums">{num(totalInput)}</p>
            <p className="text-[11px] text-gray-500">إجمالي المدخلات</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Package2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-green-700 tabular-nums">{num(totalOutput)}</p>
            <p className="text-[11px] text-gray-500">إجمالي المنتج</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-orange-600 tabular-nums">{num(totalWaste)}</p>
            <p className="text-[11px] text-gray-500">إجمالي الهدر</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-red-600 tabular-nums">{avgRoastWaste.toFixed(1)}%</p>
            <p className="text-[11px] text-gray-500">متوسط هدر التحميص</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: yieldPct >= 80 ? '#f0fdf4' : yieldPct >= 60 ? '#fffbeb' : '#fef2f2' }}>
            <Activity className="w-5 h-5" style={{ color: yieldPct >= 80 ? '#15803d' : yieldPct >= 60 ? '#b45309' : '#dc2626' }} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold tabular-nums" style={{ color: yieldPct >= 80 ? '#15803d' : yieldPct >= 60 ? '#b45309' : '#dc2626' }}>{num(yieldPct)}%</p>
            <p className="text-[11px] text-gray-500">كفاءة الإنتاج</p>
          </div>
        </div>
      </div>

      {/* ===== Quick Actions Row ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/factory/produce" className="group bg-gradient-to-br from-[#0f3460] to-[#16213e] text-white p-4 rounded-2xl shadow-sm hover:shadow-lg transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
            <Factory className="w-5 h-5 text-[#e9b44c]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm">خط التصنيع الكامل</p>
            <p className="text-[11px] text-white/50 mt-0.5">تحميص → توليف → تعبئة</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
        </Link>

        <Link href="/purchases" className="group bg-white ring-1 ring-gray-200 p-4 rounded-2xl shadow-sm hover:ring-[#0f3460]/30 transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-[#0f3460]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-[#1a1a2e]">المشتريات</p>
            <p className="text-[11px] text-gray-400 mt-0.5">أوامر شراء ومستحقات</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-gray-300 group-hover:text-[#0f3460] transition-colors" />
        </Link>

        {/* رصيد الخامات — مصغّر */}
        <div className="bg-white ring-1 ring-gray-200 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-[#1a1a2e]">رصيد الخامات</p>
            <span className="text-[10px] text-gray-400">{rawProducts.length} صنف</span>
          </div>
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
            {rawProducts.slice(0, 8).map((p) => (
              <div key={p.id} className="flex justify-between text-xs">
                <span className="text-gray-600 truncate ml-2">{p.name}</span>
                <span className={`font-bold tabular-nums shrink-0 ${p.quantity <= p.minStock ? 'text-red-600' : 'text-green-600'}`}>
                  {p.quantity} {p.unit}
                </span>
              </div>
            ))}
            {rawProducts.length === 0 && <p className="text-xs text-gray-400">لا يوجد خامات</p>}
            {rawProducts.length > 8 && <p className="text-[10px] text-gray-400 text-center pt-1">+{rawProducts.length - 8} أصناف أخرى</p>}
          </div>
        </div>
      </div>

      {/* ===== أوامر التصنيع ===== */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-100">
          <Flame className="w-4 h-4 text-[#e94560]" />
          <h3 className="text-sm font-bold text-[#1a1a2e] flex-1">أوامر التصنيع</h3>
          <span className="text-xs text-gray-400 tabular-nums">{productions.length} أمر</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
                <th className="px-4 py-2.5 font-medium">رقم الأمر</th>
                <th className="px-4 py-2.5 font-medium">الخط</th>
                <th className="px-4 py-2.5 font-medium">التشغيلة</th>
                <th className="px-4 py-2.5 font-medium">المدخل ← الناتج</th>
                <th className="px-4 py-2.5 font-medium">الهدر</th>
                <th className="px-4 py-2.5 font-medium no-print"></th>
              </tr>
            </thead>
            <tbody>
              {productions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">لا يوجد أوامر تصنيع بعد</td></tr>
              )}
              {productions.map((prod) => (
                <tr key={prod.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 align-top transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold tabular-nums text-xs text-[#0f3460]">{prod.orderNo}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{prod.roastLevel || prod.grindType || prod.stage}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${prod.lineType === 'ROASTING' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {prod.lineType === 'ROASTING' ? 'تحميص' : 'خلط وطحن'}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs text-gray-600">
                    {prod.batchNo || '—'}
                    {prod.expiryDate && (
                      <p className="text-[10px] text-gray-400">صلاحية: {new Date(prod.expiryDate).toLocaleDateString('ar-EG')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {prod.inputs.map((inp) => (
                        <span key={inp.id} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded tabular-nums">
                          {inp.product.name} {inp.quantity}{Number(inp.percentage) > 0 ? ` (${Number(inp.percentage)}%)` : ''}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {prod.items.map((item) => (
                        <span key={item.id} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded tabular-nums">
                          ← {item.product.name} +{item.quantity}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`tabular-nums font-semibold text-xs ${Number(prod.wastePercent) > 22 || (prod.lineType === 'ROASTING' && Number(prod.wastePercent) < 10 && prod.outputWeight > 0) ? 'text-red-600' : 'text-orange-600'}`}>
                      {prod.wasteWeight} ({Number(prod.wastePercent).toFixed(1)}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 no-print">
                    <Link
                      href={`/print/production/${prod.id}`}
                      className="inline-flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline"
                    >
                      <Printer className="w-3.5 h-3.5" /> بطاقة
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== الوصفات ===== */}
      <RecipeManager recipes={recipeLite} products={products.map((p) => ({ id: p.id, name: p.name, type: p.type }))} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
    </div>
  )
}
