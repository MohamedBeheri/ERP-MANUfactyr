import { prisma } from '@/lib/prisma'
import { getStoreSettings } from '@/lib/store'
import { warehouseForStage } from '@/lib/stock-stages'
import { Storefront } from '@/components/storefront'

export const dynamic = 'force-dynamic'

export default async function StorePage() {
  const settings = await getStoreSettings()
  const storeWarehouse = settings.warehouseId || (await warehouseForStage(null))

  // الأصناف المعروضة = المنتجات على مراحل "بيع"، مع رصيدها في مخزن المتجر
  const sellableStages = await prisma.stockStage.findMany({ where: { isActive: true, sellable: true }, select: { id: true } })
  const sellableIds = sellableStages.map((s) => s.id)

  const [productsRaw, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { stageId: { in: sellableIds } },
          ...(sellableIds.length === 0 ? [{ type: 'FINISHED' as const }] : []),
        ],
      },
      include: { stocks: { where: { warehouseId: storeWarehouse } } },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  const products = productsRaw
    .map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      price: Number(p.sellPrice),
      stock: p.stocks[0]?.quantity ?? 0,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl,
    }))
    .filter((p) => settings.showOutOfStock || p.stock > 0)

  const usedCategoryIds = new Set(products.map((p) => p.categoryId).filter(Boolean))

  return (
    <Storefront
      settings={{
        storeName: settings.storeName,
        tagline: settings.tagline,
        heroImage: settings.heroImage,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        address: settings.address,
        deliveryFee: Number(settings.deliveryFee),
        minOrder: Number(settings.minOrder),
        isOpen: settings.isOpen,
        showOutOfStock: settings.showOutOfStock,
      }}
      products={products}
      categories={categories.filter((c) => usedCategoryIds.has(c.id)).map((c) => ({ id: c.id, name: c.name }))}
    />
  )
}
