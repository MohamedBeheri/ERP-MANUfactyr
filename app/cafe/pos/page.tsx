import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, LayoutDashboard } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction, hasSectionAccess } from '@/lib/permissions'
import { getCafeStageIds } from '@/lib/cafe'
import { ensureStockStages } from '@/lib/stock-stages'
import { ensureTiers } from '@/lib/tiers'
import { CafePos } from '@/components/cafe-pos'

export const dynamic = 'force-dynamic'

// نقطة بيع الكافيه (الكاشير) — صفحة مستقلة بصلاحية cafe_pos
export default async function CafePosPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  // الكاشير: يقدر يبيع لو عنده صلاحية نقطة بيع الكافيه أو المبيعات العامة
  const canSell = canDoAction(perms, 'cafe_pos', 'add') || canDoAction(perms, 'sales', 'add')
  if (!hasSectionAccess(perms, 'cafe_pos') && !hasSectionAccess(perms, 'cafe') && !canSell) redirect('/dashboard')

  const canDash = hasSectionAccess(perms, 'cafe')

  const { warehouseId } = await getCafeStageIds()
  await ensureStockStages()
  await ensureTiers()

  const sellableStages = await prisma.stockStage.findMany({ where: { isActive: true, sellable: true }, select: { id: true } })
  const sellableIds = sellableStages.map((s) => s.id)
  const recipeRows = await prisma.cafeRecipeItem.findMany({ select: { productId: true }, distinct: ['productId'] })
  const recipeProductIds = new Set(recipeRows.map((r) => r.productId))

  const [posProducts, posCustomers, categories, posWarehouses] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true, showInPos: true,
        OR: [{ stageId: { in: sellableIds } }, ...(sellableIds.length === 0 ? [{ type: 'FINISHED' as const }] : [])],
      },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, include: { tier: true } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#e94560]/10 flex items-center justify-center shrink-0"><ShoppingCart className="w-6 h-6 text-[#e94560]" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">نقطة بيع الكافيه</h1>
            <p className="text-sm text-gray-500 mt-0.5">شاشة الكاشير — بيع مباشر وطباعة الإيصال</p>
          </div>
        </div>
        {canDash && <Link href="/cafe" className="flex items-center gap-2 px-4 py-2 bg-white ring-1 ring-gray-200 text-[#0f3460] rounded-lg text-sm font-semibold hover:bg-gray-50"><LayoutDashboard className="w-4 h-4" /> لوحة تحكم الكافيه</Link>}
      </div>

      <CafePos
        products={posProducts.map((p) => ({
          id: p.id, name: p.name, unit: p.unit, sellPrice: Number(p.sellPrice), wholesalePrice: Number(p.wholesalePrice),
          quantity: Number(p.quantity), categoryId: p.categoryId, imageUrl: p.imageUrl, hasRecipe: recipeProductIds.has(p.id),
        }))}
        customers={posCustomers.map((c) => ({
          id: c.id, name: c.name, customerType: c.customerType,
          tier: c.tier ? { name: c.tier.name, priceSource: c.tier.priceSource, discountPercent: Number(c.tier.discountPercent) } : null,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        warehouses={posWarehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
        cafeWarehouseId={warehouseId}
        canAdd={canSell}
      />
    </div>
  )
}
