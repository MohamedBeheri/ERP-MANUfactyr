import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Cookie } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { getCafeStageIds } from '@/lib/cafe'
import { ensureStockStages } from '@/lib/stock-stages'
import { ensureTiers } from '@/lib/tiers'
import { ensureUnits } from '@/lib/units'
import { CafeManager } from '@/components/cafe-manager'

export const dynamic = 'force-dynamic'

// الكافيه: تشغيل منفصل تمامًا عن المصنع والتجارة بالجملة —
// له مخزنه الخاص وخاماته (شوكولاتة/ديزرت/مكونات مشروبات) ومنتجاته وتوليفاته
export default async function CafePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canAdd = canDoAction(perms, 'cafe', 'add')
  const canEdit = canDoAction(perms, 'cafe', 'edit')
  const canDelete = canDoAction(perms, 'cafe', 'delete')

  const canSell = canDoAction(perms, 'sales', 'add')

  const { warehouseId, materialsStageId, itemsStageId } = await getCafeStageIds()
  await ensureStockStages()
  await ensureTiers()
  await ensureUnits()

  // نقطة البيع (اتنقلت هنا من شاشة المبيعات): كل الأصناف القابلة للبيع بما فيها منتجات الكافيه
  const sellableStages = await prisma.stockStage.findMany({ where: { isActive: true, sellable: true }, select: { id: true } })
  const sellableIds = sellableStages.map((s) => s.id)

  // الأصناف اللي ليها توليفة استهلاك — رصيدها بيتحدد من الخامات وقت البيع مش من كميتها
  const recipeRows = await prisma.cafeRecipeItem.findMany({ select: { productId: true }, distinct: ['productId'] })
  const recipeProductIds = new Set(recipeRows.map((r) => r.productId))

  const [cafeWarehouse, materials, cafeItems, categories, purchases, movements, posProducts, posCustomers, posWarehouses, units] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    prisma.product.findMany({
      where: { stageId: materialsStageId, isActive: true },
      include: { stocks: true, category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { stageId: itemsStageId, isActive: true },
      include: {
        stocks: true,
        cafeRecipeAsProduct: { include: { material: { select: { id: true, name: true, unit: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.purchase.findMany({
      where: { items: { some: { product: { itemKind: 'CAFE_MATERIAL' } } } },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // آخر حركات الوارد على مخزن الكافيه — عشان يبان مصدر كل كمية (فاتورة شراء أو تحويل من مخزن تاني)
    prisma.warehouseIn.findMany({
      where: { warehouseId, product: { itemKind: 'CAFE_MATERIAL' } },
      include: { product: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        showInPos: true,
        OR: [
          { stageId: { in: sellableIds } },
          ...(sellableIds.length === 0 ? [{ type: 'FINISHED' as const }] : []),
        ],
      },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, include: { tier: true } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Cookie className="w-6 h-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">إدارة الكافيه</h1>
          <p className="text-sm text-gray-500 mt-0.5">تشغيل منفصل: خامات (شوكولاتة/ديزرت/مكونات) + منتجات مباعة + توليفات استهلاك تتحكم في المخزون عند البيع</p>
        </div>
      </div>

      <CafeManager
        warehouses={cafeWarehouse ? [{ id: cafeWarehouse.id, name: cafeWarehouse.name, isDefault: true }] : []}
        materials={materials.map((m) => ({
          id: m.id,
          name: m.name,
          unit: m.unit,
          costPrice: Number(m.costPrice),
          minStock: Number(m.minStock),
          category: m.category?.name || null,
          stock: Number(m.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0),
          stocks: m.stocks.map((s) => ({ warehouseId: s.warehouseId, quantity: Number(s.quantity) })),
        }))}
        movements={movements.map((mv) => ({
          id: mv.id,
          productName: mv.product.name,
          unit: mv.product.unit,
          quantity: Number(mv.quantity),
          source: mv.source,
          createdAt: mv.createdAt.toISOString(),
        }))}
        cafeItems={cafeItems.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          sellPrice: Number(p.sellPrice),
          categoryId: p.categoryId,
          showInPos: p.showInPos,
          stock: Number(p.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0),
          recipe: p.cafeRecipeAsProduct.map((r) => ({
            materialId: r.materialId,
            materialName: r.material.name,
            unit: r.material.unit,
            quantity: Number(r.quantity),
          })),
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        purchases={purchases.map((p) => ({
          id: p.id,
          invoiceNo: p.invoiceNo,
          supplier: p.supplier.name,
          total: Number(p.totalAmount),
          createdAt: p.createdAt.toISOString(),
          items: p.items
            .filter((i) => i.product.itemKind === 'CAFE_MATERIAL')
            .map((i) => ({ name: i.product.name, quantity: Number(i.quantity), unit: i.product.unit })),
        }))}
        pos={{
          products: posProducts.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            sellPrice: Number(p.sellPrice),
            wholesalePrice: Number(p.wholesalePrice),
            quantity: Number(p.quantity),
            categoryId: p.categoryId,
            imageUrl: p.imageUrl,
            hasRecipe: recipeProductIds.has(p.id),
          })),
          customers: posCustomers.map((c) => ({
            id: c.id,
            name: c.name,
            customerType: c.customerType,
            tier: c.tier
              ? { name: c.tier.name, priceSource: c.tier.priceSource, discountPercent: Number(c.tier.discountPercent) }
              : null,
          })),
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
          warehouses: posWarehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault })),
          cafeWarehouseId: warehouseId,
          canSell,
        }}
        units={units.map((u) => ({ id: u.id, name: u.name }))}
        canAdd={canAdd}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  )
}
