import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultWarehouseId } from '@/lib/warehouse'
import { ensureStockStages } from '@/lib/stock-stages'
import { SettingsManager } from '@/components/settings-manager'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  await getDefaultWarehouseId() // يضمن وجود مخزن افتراضي
  await ensureStockStages() // يضمن وجود المراحل والعمليات الافتراضية

  const [suppliers, categories, products, stockStages, operations, warehouses] = await Promise.all([
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }] }),
    prisma.stockStage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { products: true } }, warehouse: true },
    }),
    prisma.productionOperation.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { inputStage: true, outputStage: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">الإعدادات والبيانات الأساسية</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          تحكم كامل في الأصناف والمراحل المخزنية وعمليات التصنيع والموردين والمخازن
        </p>
      </div>

      <SettingsManager
        suppliers={suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          address: s.address,
          email: s.email,
          rating: s.rating,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          categoryId: p.categoryId,
          stageId: p.stageId,
          costPrice: Number(p.costPrice),
          sellPrice: Number(p.sellPrice),
          wholesalePrice: Number(p.wholesalePrice),
          minStock: p.minStock,
          quantity: p.quantity,
          unit: p.unit,
          imageUrl: p.imageUrl,
        }))}
        stockStages={stockStages.map((s) => ({
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          sellable: s.sellable,
          purchasable: s.purchasable,
          warehouseId: s.warehouseId,
          warehouseName: s.warehouse?.name || null,
          productCount: s._count.products,
        }))}
        operations={operations.map((op) => ({
          id: op.id,
          name: op.name,
          inputStageId: op.inputStageId,
          outputStageId: op.outputStageId,
          inputStageName: op.inputStage?.name || null,
          outputStageName: op.outputStage?.name || null,
          hasYieldLoss: op.hasYieldLoss,
          sortOrder: op.sortOrder,
        }))}
        warehouses={warehouses.map((w) => ({
          id: w.id,
          name: w.name,
          location: w.location,
          isDefault: w.isDefault,
        }))}
      />
    </div>
  )
}
