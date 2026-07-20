import { prisma } from '@/lib/prisma'
import { ensureStockStages } from '@/lib/stock-stages'

// يضمن وجود إعدادات المتجر ويحدد مخزن البيع الافتراضي (مخزن المنتجات)
export async function getStoreSettings() {
  await ensureStockStages()
  let settings = await prisma.storeSettings.findUnique({ where: { id: 'store' } })
  if (!settings) {
    const productsWh = await prisma.warehouse.findFirst({
      where: { isActive: true, name: 'مخزن المنتجات' },
    })
    const fallback = await prisma.warehouse.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    settings = await prisma.storeSettings.create({
      data: { id: 'store', warehouseId: productsWh?.id || fallback?.id || null },
    })
  }
  return settings
}
