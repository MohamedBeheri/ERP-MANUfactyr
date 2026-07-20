import { prisma } from '@/lib/prisma'
import { getStoreSettings } from '@/lib/store'
import { warehouseForStage } from '@/lib/stock-stages'
import { Storefront } from '@/components/storefront'

export const dynamic = 'force-dynamic'

export default async function StorePage() {
  const settings = await getStoreSettings()
  const storeWarehouse = settings.warehouseId || (await warehouseForStage(null))

  const sellableStages = await prisma.stockStage.findMany({ where: { isActive: true, sellable: true }, select: { id: true } })
  const sellableIds = sellableStages.map((s) => s.id)

  const [productsRaw, categories, slides, bestSellerRows] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        OR: [{ stageId: { in: sellableIds } }, ...(sellableIds.length === 0 ? [{ type: 'FINISHED' as const }] : [])],
      },
      include: { stocks: { where: { warehouseId: storeWarehouse } } },
      orderBy: { createdAt: 'desc' }, // الأحدث أولاً
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.heroSlide.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    // الأكثر مبيعًا من بنود الفواتير
    prisma.invoiceItem.groupBy({ by: ['productId'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 12 }),
  ])

  const storeBlocks = await prisma.storeBlock.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const bestRank = new Map(bestSellerRows.map((r, i) => [r.productId, i]))

  const products = productsRaw
    .map((p, idx) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      price: Number(p.sellPrice),
      stock: p.stocks[0]?.quantity ?? 0,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl,
      isNew: idx < 12, // الأحدث (مرتبين بتاريخ الإنشاء)
      bestRank: bestRank.has(p.id) ? bestRank.get(p.id)! : null,
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
        accentColor: settings.accentColor,
        light: settings.bgTheme === 'light',
        promoText: settings.promoText,
        promoLink: settings.promoLink,
        aboutTitle: settings.aboutTitle,
        aboutText: settings.aboutText,
        facebook: settings.facebook,
        instagram: settings.instagram,
        email: settings.email,
      }}
      products={products}
      categories={categories.filter((c) => usedCategoryIds.has(c.id)).map((c) => ({ id: c.id, name: c.name }))}
      slides={slides.map((s) => ({
        id: s.id, type: s.type, media: s.media, badge: s.badge,
        title1: s.title1, title2: s.title2, subtitle: s.subtitle, ctaText: s.ctaText, ctaLink: s.ctaLink,
      }))}
      blocks={storeBlocks.map((b) => ({
        id: b.id, kind: b.kind, title: b.title, subtitle: b.subtitle,
        imageUrl: b.imageUrl, link: b.link, rating: b.rating,
      }))}
    />
  )
}
