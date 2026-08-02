import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Cookie } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { getCafeStageIds } from '@/lib/cafe'
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

  const { warehouseId, materialsStageId, itemsStageId } = await getCafeStageIds()

  const [cafeWarehouse, materials, cafeItems, categories, purchases] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    prisma.product.findMany({
      where: { stageId: materialsStageId, isActive: true },
      include: { stocks: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { stageId: itemsStageId, isActive: true },
      include: { cafeRecipeAsProduct: { include: { material: { select: { id: true, name: true, unit: true } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.purchase.findMany({
      where: { items: { some: { product: { itemKind: 'CAFE_MATERIAL' } } } },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
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
          minStock: m.minStock,
          stock: m.stocks.find((s) => s.warehouseId === warehouseId)?.quantity ?? 0,
          stocks: m.stocks.map((s) => ({ warehouseId: s.warehouseId, quantity: s.quantity })),
        }))}
        cafeItems={cafeItems.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          sellPrice: Number(p.sellPrice),
          categoryId: p.categoryId,
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
            .map((i) => ({ name: i.product.name, quantity: i.quantity, unit: i.product.unit })),
        }))}
        canAdd={canAdd}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  )
}
