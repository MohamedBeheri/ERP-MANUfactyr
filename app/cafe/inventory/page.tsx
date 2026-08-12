import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Boxes, LayoutDashboard } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction, hasSectionAccess } from '@/lib/permissions'
import { getCafeStageIds } from '@/lib/cafe'
import { ensureStockStages } from '@/lib/stock-stages'
import { ensureUnits } from '@/lib/units'
import { CafeInventory } from '@/components/cafe-parts'

export const dynamic = 'force-dynamic'

// مخزن الكافيه — المنتجات الجاهزة + المواد الخام + حركات الوارد، بصلاحية cafe_inventory
export default async function CafeInventoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!hasSectionAccess(perms, 'cafe_inventory') && !hasSectionAccess(perms, 'cafe')) redirect('/dashboard')

  const canAdd = canDoAction(perms, 'cafe_inventory', 'add') || canDoAction(perms, 'cafe', 'add')
  const canEdit = canDoAction(perms, 'cafe_inventory', 'edit') || canDoAction(perms, 'cafe', 'edit')
  const canDelete = canDoAction(perms, 'cafe_inventory', 'delete') || canDoAction(perms, 'cafe', 'delete')
  const canDash = hasSectionAccess(perms, 'cafe')

  const { warehouseId, materialsStageId, itemsStageId } = await getCafeStageIds()
  await ensureStockStages()
  await ensureUnits()

  const [materials, cafeItems, categories, movements, units] = await Promise.all([
    prisma.product.findMany({ where: { stageId: materialsStageId, isActive: true }, include: { stocks: true, category: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({
      where: { stageId: itemsStageId, isActive: true },
      include: { stocks: true, cafeRecipeAsProduct: { include: { material: { select: { id: true, name: true, unit: true } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.warehouseIn.findMany({
      where: { warehouseId, product: { itemKind: 'CAFE_MATERIAL' } },
      include: { product: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' }, take: 30,
    }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Boxes className="w-6 h-6 text-amber-700" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">مخزن الكافيه</h1>
            <p className="text-sm text-gray-500 mt-0.5">المنتجات الجاهزة + المواد الخام + حركات الوارد على مخزن الكافيه</p>
          </div>
        </div>
        {canDash && <Link href="/cafe" className="flex items-center gap-2 px-4 py-2 bg-white ring-1 ring-gray-200 text-[#0f3460] rounded-lg text-sm font-semibold hover:bg-gray-50"><LayoutDashboard className="w-4 h-4" /> لوحة تحكم الكافيه</Link>}
      </div>

      <CafeInventory
        materials={materials.map((m) => ({
          id: m.id, name: m.name, unit: m.unit, costPrice: Number(m.costPrice), minStock: Number(m.minStock), category: m.category?.name || null,
          stock: Number(m.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0),
        }))}
        cafeItems={cafeItems.map((p) => ({
          id: p.id, name: p.name, unit: p.unit, sellPrice: Number(p.sellPrice), categoryId: p.categoryId, showInPos: p.showInPos,
          stock: Number(p.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0),
          recipe: p.cafeRecipeAsProduct.map((r) => ({ materialId: r.materialId, materialName: r.material.name, unit: r.material.unit, quantity: Number(r.quantity) })),
        }))}
        movements={movements.map((mv) => ({ id: mv.id, productName: mv.product.name, unit: mv.product.unit, quantity: Number(mv.quantity), source: mv.source, createdAt: mv.createdAt.toISOString() }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        units={units.map((u) => ({ id: u.id, name: u.name }))}
        canAdd={canAdd} canEdit={canEdit} canDelete={canDelete}
      />
    </div>
  )
}
