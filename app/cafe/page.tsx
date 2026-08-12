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

export const dynamic = 'force-dynamic'

// لوحة تحكم الكافيه: ملخص + إدارة المنتجات والتوليفات + المشتريات
export default async function CafePage() {
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
        <div className="flex gap-2">
          {canPos && <Link href="/cafe/pos" className="flex items-center gap-2 px-4 py-2 bg-[#e94560] text-white rounded-lg text-sm font-semibold hover:bg-[#d13350]"><ShoppingCart className="w-4 h-4" /> نقطة البيع</Link>}
          {canInv && <Link href="/cafe/inventory" className="flex items-center gap-2 px-4 py-2 bg-white ring-1 ring-gray-200 text-[#0f3460] rounded-lg text-sm font-semibold hover:bg-gray-50"><Boxes className="w-4 h-4" /> مخزن الكافيه</Link>}
        </div>
      </div>

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
        canAdd={canAdd} canEdit={canEdit} canDelete={canDelete}
      />
    </div>
  )
}
