import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Cookie, ShoppingCart, Boxes } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction, hasSectionAccess } from '@/lib/permissions'
import { getCafeStageIds } from '@/lib/cafe'
import { ensureStockStages } from '@/lib/stock-stages'
import { ensureUnits } from '@/lib/units'
import { CafeDashboard } from '@/components/cafe-parts'
import { CafeCashbox } from '@/components/cafe-cashbox'
import { CafeInvoicesLog } from '@/components/cafe-invoices-log'
import { PeriodSelector } from '@/components/period-selector'

export const dynamic = 'force-dynamic'

function buildCafePeriod(sp: { days?: string; from?: string; to?: string }) {
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

// لوحة تحكم الكافيه: ملخص + تحليلات مبيعات + إدارة المنتجات والتوليفات + المشتريات
export default async function CafePage({ searchParams: raw }: { searchParams: Promise<{ days?: string; from?: string; to?: string }> }) {
  const sp = await raw
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!hasSectionAccess(perms, 'cafe')) redirect('/cafe/pos')

  const canAdd = canDoAction(perms, 'cafe', 'add')
  const canEdit = canDoAction(perms, 'cafe', 'edit')
  const canDelete = canDoAction(perms, 'cafe', 'delete')
  const canPos = hasSectionAccess(perms, 'cafe_pos')
  const canInv = hasSectionAccess(perms, 'cafe_inventory')

  const { warehouseId, materialsStageId, itemsStageId } = await getCafeStageIds()
  await ensureStockStages()
  await ensureUnits()

  const [materials, cafeItems, categories, purchases, units] = await Promise.all([
    prisma.product.findMany({ where: { stageId: materialsStageId, isActive: true }, include: { stocks: true, category: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({
      where: { stageId: itemsStageId, isActive: true },
      include: { stocks: true, cafeRecipeAsProduct: { include: { material: { select: { id: true, name: true, unit: true } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.purchase.findMany({
      where: { items: { some: { product: { itemKind: 'CAFE_MATERIAL' } } } },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }, take: 20,
    }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  ])

  const materialsMapped = materials.map((m) => ({
    id: m.id, name: m.name, unit: m.unit, costPrice: Number(m.costPrice), minStock: Number(m.minStock),
    category: m.category?.name || null,
    stock: Number(m.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0),
  }))
  const itemsMapped = cafeItems.map((p) => ({
    id: p.id, name: p.name, unit: p.unit, sellPrice: Number(p.sellPrice), categoryId: p.categoryId, showInPos: p.showInPos,
    stock: Number(p.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0),
    recipe: p.cafeRecipeAsProduct.map((r) => ({ materialId: r.materialId, materialName: r.material.name, unit: r.material.unit, quantity: Number(r.quantity) })),
  }))

  const kpis = {
    itemsCount: itemsMapped.length,
    materialsCount: materialsMapped.length,
    lowStockMaterials: materialsMapped.filter((m) => m.minStock > 0 && m.stock <= m.minStock).length,
    posVisible: itemsMapped.filter((i) => i.showInPos).length,
  }

  // تحليلات مبيعات الكافيه في الفترة — بنود الفواتير لأصناف الكافيه (منتجات مرحلة منتجات الكافيه)
  const { from, to, days } = buildCafePeriod(sp)
  const cafeItemIds = cafeItems.map((p) => p.id)
  const cafeSaleItems = cafeItemIds.length > 0
    ? await prisma.invoiceItem.findMany({
        where: { productId: { in: cafeItemIds }, invoice: { createdAt: { gte: from, lte: to }, status: 'COMPLETED' } },
        include: { invoice: { select: { createdAt: true } }, product: { select: { name: true } } },
      })
    : []
  const salesTotal = cafeSaleItems.reduce((s, it) => s + Number(it.totalPrice), 0)
  const dayKey = (d: Date) => d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
  const trendLabels: string[] = []
  const trend: number[] = []
  const cur = new Date(from)
  for (let i = 0; i < days; i++) {
    trendLabels.push(dayKey(cur))
    const ds = new Date(cur); ds.setHours(0, 0, 0, 0)
    const de = new Date(cur); de.setHours(23, 59, 59, 999)
    trend.push(cafeSaleItems.filter((it) => it.invoice.createdAt >= ds && it.invoice.createdAt <= de).reduce((s, it) => s + Number(it.totalPrice), 0))
    cur.setDate(cur.getDate() + 1)
  }
  const topMap = new Map<string, number>()
  for (const it of cafeSaleItems) topMap.set(it.product.name, (topMap.get(it.product.name) || 0) + Number(it.totalPrice))
  const topProducts = Array.from(topMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  const cafeSales = { total: salesTotal, count: cafeSaleItems.length, trendLabels, trend, topProducts }

  // خزنة الكافيه (نقدية) + حركاتها + تسوياتها مع العمومية — نفس مسار خزنة المخزن
  const [cafeTreasury, cafeSettlements, cafeTxns, cafeInvoices] = await Promise.all([
    prisma.treasury.findUnique({ where: { warehouseId }, select: { balance: true } }),
    prisma.treasurySettlement.findMany({
      where: { warehouseId },
      include: { createdBy: { select: { name: true } }, acceptedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 15,
    }),
    prisma.treasuryTransaction.findMany({
      where: { treasury: { warehouseId } },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 40,
    }),
    cafeItemIds.length > 0
      ? prisma.invoice.findMany({
          where: { items: { some: { productId: { in: cafeItemIds } } } },
          include: { customer: { select: { name: true } }, creator: { select: { name: true } }, items: { include: { product: { select: { name: true, unit: true } } } } },
          orderBy: { createdAt: 'desc' }, take: 100,
        })
      : Promise.resolve([]),
  ])
  const canSettle = canDoAction(perms, 'warehouse', 'edit') || canEdit
  const isAdmin = session.user.role === 'ADMIN'

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Cookie className="w-6 h-6 text-amber-700" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">لوحة تحكم الكافيه</h1>
            <p className="text-sm text-gray-500 mt-0.5">المنتجات والتوليفات والمشتريات — نقطة البيع والمخزن في صفحات منفصلة</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <PeriodSelector current={sp.from && sp.to ? 0 : days} basePath="/cafe" theme="light" />
          {canPos && <Link href="/cafe/pos" className="flex items-center gap-2 px-4 py-2 bg-[#e94560] text-white rounded-lg text-sm font-semibold hover:bg-[#d13350]"><ShoppingCart className="w-4 h-4" /> نقطة البيع</Link>}
          {canInv && <Link href="/cafe/inventory" className="flex items-center gap-2 px-4 py-2 bg-white ring-1 ring-gray-200 text-[#0f3460] rounded-lg text-sm font-semibold hover:bg-gray-50"><Boxes className="w-4 h-4" /> مخزن الكافيه</Link>}
        </div>
      </div>

      <CafeCashbox
        warehouseId={warehouseId}
        balance={Number(cafeTreasury?.balance || 0)}
        canSettle={canSettle}
        settlements={cafeSettlements.map((s) => ({
          id: s.id, settlementNo: s.settlementNo, amount: Number(s.amount), status: s.status,
          createdByName: s.createdBy?.name || null, acceptedByName: s.acceptedBy?.name || null,
          createdAt: s.createdAt.toISOString(),
        }))}
        movements={cafeTxns.map((t) => ({
          id: t.id, type: t.type, amount: Number(t.amount), balance: Number(t.balance),
          description: t.description, reference: t.reference, createdByName: t.createdBy?.name || null,
          createdAt: t.createdAt.toISOString(),
        }))}
      />

      <CafeInvoicesLog
        isAdmin={isAdmin}
        cafeWarehouseId={warehouseId}
        products={itemsMapped.map((p) => ({ id: p.id, name: p.name, unit: p.unit, sellPrice: p.sellPrice }))}
        invoices={cafeInvoices.map((inv) => ({
          id: inv.id, invoiceNo: inv.invoiceNo, customerName: inv.customer?.name || null, creatorName: inv.creator?.name || null,
          type: inv.type, paymentMethod: inv.paymentMethod, discount: Number(inv.discount),
          totalAmount: Number(inv.totalAmount), netAmount: Number(inv.netAmount), createdAt: inv.createdAt.toISOString(),
          items: inv.items.map((it) => ({ productId: it.productId, name: it.product.name, unit: it.product.unit, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice), isBonus: it.isBonus })),
        }))}
      />

      <CafeDashboard
        cafeItems={itemsMapped}
        materials={materialsMapped}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        purchases={purchases.map((p) => ({
          id: p.id, invoiceNo: p.invoiceNo, supplier: p.supplier.name, total: Number(p.totalAmount), createdAt: p.createdAt.toISOString(),
          items: p.items.filter((i) => i.product.itemKind === 'CAFE_MATERIAL').map((i) => ({ name: i.product.name, quantity: Number(i.quantity), unit: i.product.unit })),
        }))}
        units={units.map((u) => ({ id: u.id, name: u.name }))}
        kpis={kpis}
        sales={cafeSales}
        canAdd={canAdd} canEdit={canEdit} canDelete={canDelete}
      />
    </div>
  )
}
