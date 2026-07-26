import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureStockStages } from '@/lib/stock-stages'
import { FactoryProduction } from '@/components/factory-production'

export const dynamic = 'force-dynamic'

// خط التصنيع الكامل: تحميص ← توليف ← طحن ← تعبئة وتغليف ← مخزن المنتجات
export default async function ProducePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  await ensureStockStages()

  const [greens, roastedProducts, blends, finished, productions, kpiAgg] = await Promise.all([
    // بن أخضر (مدخل التحميص)
    prisma.product.findMany({ where: { isActive: true, itemKind: 'GREEN' }, orderBy: { name: 'asc' } }),
    // حبوب محمصة (مدخل الطحن): محمص أصل أو حبوب توليفة
    prisma.product.findMany({ where: { isActive: true, itemKind: { in: ['ROASTED', 'ROASTED_BLEND'] } }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({
      where: { isActive: true, itemKind: 'BLEND' },
      orderBy: { name: 'asc' },
      include: { blendComponents: { include: { component: true } } },
    }),
    prisma.product.findMany({
      where: { isActive: true, itemKind: 'FINISHED' },
      orderBy: { name: 'asc' },
      include: { blend: true, packaging: true },
    }),
    // آخر التشغيلات بكل المراحل
    prisma.production.findMany({
      where: { OR: [{ orderNo: { startsWith: 'RST-' } }, { orderNo: { startsWith: 'BLD-' } }, { orderNo: { startsWith: 'GRD-' } }, { orderNo: { startsWith: 'PACK-' } }, { orderNo: { startsWith: 'BLND-' } }] },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { items: { include: { product: true } }, inputs: { include: { product: true } } },
    }),
    // KPI تراكمي لكل مرحلة
    Promise.all([
      prisma.production.aggregate({ where: { orderNo: { startsWith: 'RST-' } }, _sum: { inputWeight: true, outputWeight: true, wasteWeight: true }, _count: true }),
      prisma.production.aggregate({ where: { orderNo: { startsWith: 'GRD-' } }, _sum: { inputWeight: true, outputWeight: true, wasteWeight: true }, _count: true }),
      prisma.production.aggregate({ where: { orderNo: { startsWith: 'PACK-' } }, _sum: { inputWeight: true, outputWeight: true, wasteWeight: true }, _count: true }),
    ]),
  ])

  const [roastAgg, grindAgg, packAgg] = kpiAgg
  const kpi = {
    greenIn: roastAgg._sum.inputWeight || 0,
    roastedOut: roastAgg._sum.outputWeight || 0,
    roastWaste: roastAgg._sum.wasteWeight || 0,
    roastCount: roastAgg._count,
    grindIn: grindAgg._sum.inputWeight || 0,
    grindOut: grindAgg._sum.outputWeight || 0,
    grindWaste: grindAgg._sum.wasteWeight || 0,
    packCoffee: packAgg._sum.inputWeight || 0, // كجم بن استُهلك في التعبئة
    packUnits: packAgg._sum.outputWeight || 0, // عدد العبوات
    packWaste: packAgg._sum.wasteWeight || 0,
  }

  const stageOf = (orderNo: string) =>
    orderNo.startsWith('RST-') ? 'تحميص' : orderNo.startsWith('BLD-') ? 'توليف' : orderNo.startsWith('GRD-') ? 'طحن' : 'تعبئة'

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/factory" className="p-2 text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 rounded-lg" aria-label="رجوع">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">خط التصنيع</h1>
          <p className="text-sm text-gray-500 mt-0.5">تحميص ← توليف ← طحن ← تعبئة وتغليف — كل مرحلة بتشغيلة مستقلة وهدر متتبَّع</p>
        </div>
      </div>

      <FactoryProduction
        greens={greens.map((g) => ({ id: g.id, name: g.name, quantity: g.quantity, roastLoss: Number(g.roastLossPercent) }))}
        roastedProducts={roastedProducts.map((r) => ({ id: r.id, name: r.name, quantity: r.quantity, isBlendBeans: r.itemKind === 'ROASTED_BLEND' }))}
        blends={blends.map((b) => ({
          id: b.id,
          name: b.name,
          quantity: b.quantity,
          components: b.blendComponents.map((c) => ({
            name: c.component.name,
            kind: c.component.itemKind,
            percent: Number(c.percent),
            roastDegree: c.roastDegree,
            perKilo: Number(c.perKilo),
            unit: c.component.unit,
          })),
        }))}
        finished={finished.map((f) => ({
          id: f.id,
          name: f.name,
          blendName: f.blend?.name || null,
          hasBlend: !!f.blendId,
          gramsPerPiece: Number(f.gramsPerPiece),
          piecesPerBox: f.piecesPerBox,
          tare: Number(f.packaging?.tareWeight || 0),
          packagingName: f.packaging?.name || null,
        }))}
        productions={productions.map((p) => ({
          id: p.id,
          orderNo: p.orderNo,
          batchNo: p.batchNo,
          stage: stageOf(p.orderNo),
          stageDetail: p.stage,
          roastLevel: p.roastLevel,
          grindType: p.grindType,
          output: p.items.map((i) => `${i.product.name} ×${i.quantity}`).join('، '),
          inputWeight: p.inputWeight,
          outputWeight: p.outputWeight,
          wasteWeight: p.wasteWeight,
          wastePercent: Number(p.wastePercent),
          wasteExceeded: p.wasteExceeded,
          channel: p.channel,
          createdAt: p.createdAt.toISOString(),
        }))}
        kpi={kpi}
      />
    </div>
  )
}
