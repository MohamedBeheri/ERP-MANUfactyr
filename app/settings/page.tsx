import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultWarehouseId } from '@/lib/warehouse'
import { SettingsManager } from '@/components/settings-manager'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  await getDefaultWarehouseId() // يضمن وجود مخزن افتراضي

  const [suppliers, categories, products, stages, warehouses] = await Promise.all([
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.productionStage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">الإعدادات والبيانات الأساسية</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          تحكم كامل في الأصناف والتصنيفات والموردين ومراحل التصنيع والمخازن
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
          costPrice: Number(p.costPrice),
          sellPrice: Number(p.sellPrice),
          wholesalePrice: Number(p.wholesalePrice),
          minStock: p.minStock,
          quantity: p.quantity,
          unit: p.unit,
        }))}
        stages={stages.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder }))}
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
