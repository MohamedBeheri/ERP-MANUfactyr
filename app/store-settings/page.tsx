import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStoreSettings } from '@/lib/store'
import { StoreManager } from '@/components/store-manager'
import { HeroManager } from '@/components/hero-manager'
import { StoreBlocksManager } from '@/components/store-blocks-manager'

export const dynamic = 'force-dynamic'

export default async function StoreSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const settings = await getStoreSettings()

  const [warehouses, orders, slides] = await Promise.all([
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.onlineOrder.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.heroSlide.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  ])

  const storeBlocks = await prisma.storeBlock.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const proto = h.get('x-forwarded-proto') || 'https'
  const storeUrl = host ? `${proto}://${host}/store` : '/store'

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">إعداد موقع العميل</h1>
        <p className="text-sm text-gray-500 mt-0.5">متجر أونلاين مربوط بمنتجات ومخازن المصنع — العميل يطلب والطلب يوصلك هنا</p>
      </div>

      <StoreManager
        settings={{
          storeName: settings.storeName,
          tagline: settings.tagline,
          phone: settings.phone,
          whatsapp: settings.whatsapp,
          address: settings.address,
          deliveryFee: Number(settings.deliveryFee),
          minOrder: Number(settings.minOrder),
          warehouseId: settings.warehouseId,
          isOpen: settings.isOpen,
          showOutOfStock: settings.showOutOfStock,
          codEnabled: settings.codEnabled,
          cardEnabled: settings.cardEnabled,
          heroInterval: settings.heroInterval,
          heroMotion: settings.heroMotion,
          accentColor: settings.accentColor,
          bgTheme: settings.bgTheme,
          fontFamily: settings.fontFamily,
          promoText: settings.promoText,
          promoLink: settings.promoLink,
          aboutTitle: settings.aboutTitle,
          aboutText: settings.aboutText,
          facebook: settings.facebook,
          instagram: settings.instagram,
          email: settings.email,
        }}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        orders={orders.map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          customerName: o.customerName,
          phone: o.phone,
          address: o.address,
          total: Number(o.total),
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          itemsText: o.items.map((i) => `${i.productName} ×${i.quantity}`).join('، '),
          paymentMethod: o.paymentMethod,
        }))}
        storeUrl={storeUrl}
      />

      <HeroManager
        slides={slides.map((s) => ({
          id: s.id,
          type: s.type,
          media: s.media,
          badge: s.badge,
          title1: s.title1,
          title2: s.title2,
          subtitle: s.subtitle,
          ctaText: s.ctaText,
          ctaLink: s.ctaLink,
          sortOrder: s.sortOrder,
        }))}
      />

      <StoreBlocksManager
        blocks={storeBlocks.map((b) => ({
          id: b.id,
          kind: b.kind,
          title: b.title,
          subtitle: b.subtitle,
          imageUrl: b.imageUrl,
          link: b.link,
          rating: b.rating,
          sortOrder: b.sortOrder,
        }))}
      />
    </div>
  )
}
