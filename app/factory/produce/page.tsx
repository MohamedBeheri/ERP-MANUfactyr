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

  const [greens, blends, finished, roastedAll, flavorAll, spiceAll, packagingAll, productions, kpiAgg] = await Promise.all([
    // بن أخضر (مدخل التحميص)
    prisma.product.findMany({ where: { isActive: true, itemKind: 'GREEN' }, orderBy: { name: 'asc' } }),
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
    // بن محمص (للتوليفة المخصصة)
    prisma.product.findMany({ where: { isActive: true, itemKind: 'ROASTED' }, orderBy: { name: 'asc' } }),
    // نكهات (للتوليفة المخصصة)
    prisma.product.findMany({ where: { isActive: true, itemKind: 'FLAVOR' }, orderBy: { name: 'asc' } }),
    // عطارة (للتوليفة المخصصة)
    prisma.product.findMany({ where: { isActive: true, itemKind: 'SPICE' }, orderBy: { name: 'asc' } }),
    // مواد تغليف (للتعبئة)
    prisma.product.findMany({ where: { isActive: true, itemKind: 'PACKAGING' }, orderBy: { name: 'asc' } }),
    // آخر التشغيلات بكل المراحل
    prisma.production.findMany({
      where: { OR: [{ orderNo: { startsWith: 'RST-' } }, { orderNo: { startsWith: 'BLD-' } }, { orderNo: { startsWith: 'GRD-' } }, { orderNo: { startsWith: 'PACK-' } }, { orderNo: { startsWith: 'BLND-' } }] },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { items: { include: { product: { include: { packaging: true } } } }, inputs: { include: { product: true } } },
    }),
    // KPI تراكمي لكل مرحلة (BLD = طحن وتوليف مندمجين، GRD القديم بيتجمّع كمان لو موجود)
    Promise.all([
      prisma.production.aggregate({ where: { orderNo: { startsWith: 'RST-' } }, _sum: { inputWeight: true, outputWeight: true, wasteWeight: true }, _count: true }),
      prisma.production.aggregate({ where: { OR: [{ orderNo: { startsWith: 'BLD-' } }, { orderNo: { startsWith: 'GRD-' } }] }, _sum: { inputWeight: true, outputWeight: true, wasteWeight: true }, _count: true }),
      prisma.production.aggregate({ where: { orderNo: { startsWith: 'PACK-' } }, _sum: { inputWeight: true, outputWeight: true, wasteWeight: true }, _count: true }),
    ]),
  ])

  const [roastAgg, gbAgg, packAgg] = kpiAgg
  const kpi = {
    greenIn: Number(roastAgg._sum.inputWeight) || 0,
    roastedOut: Number(roastAgg._sum.outputWeight) || 0,
    roastWaste: Number(roastAgg._sum.wasteWeight) || 0,
    roastCount: roastAgg._count,
    grindIn: Number(gbAgg._sum.inputWeight) || 0,
    grindOut: Number(gbAgg._sum.outputWeight) || 0,
    grindWaste: Number(gbAgg._sum.wasteWeight) || 0,
    packCoffee: Number(packAgg._sum.inputWeight) || 0, // كجم بن استُهلك في التعبئة
    packUnits: Number(packAgg._sum.outputWeight) || 0, // عدد العبوات
    packWaste: Number(packAgg._sum.wasteWeight) || 0,
  }

  const stageOf = (orderNo: string) =>
    orderNo.startsWith('RST-') ? 'تحميص' : (orderNo.startsWith('BLD-') || orderNo.startsWith('GRD-')) ? 'طحن وتوليف' : 'تعبئة'

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
        greens={greens.map((g) => ({ id: g.id, name: g.name, quantity: Number(g.quantity), roastLoss: Number(g.roastLossPercent) }))}
        blends={blends.map((b) => ({
          id: b.id,
          name: b.name,
          quantity: Number(b.quantity),
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
          packagingId: f.packagingId || null,
        }))}
        packagings={packagingAll.map((p) => ({
          id: p.id,
          name: p.name,
          quantity: Number(p.quantity),
          tare: Number(p.tareWeight), // وزن القطعة (جرام) — للقسمة
          rollWeight: Number(p.rollWeight), // وزن الرول (كجم) — للسحب التلقائي
          estTare: Number(p.estTareWeight), // وزن الفارغة التقديري
          unit: p.unit,
        }))}
        availableIngredients={[
          ...roastedAll.map((p) => ({ id: p.id, name: p.name, quantity: Number(p.quantity), kind: 'ROASTED' as const })),
          ...flavorAll.map((p) => ({ id: p.id, name: p.name, quantity: Number(p.quantity), kind: 'FLAVOR' as const })),
          ...spiceAll.map((p) => ({ id: p.id, name: p.name, quantity: Number(p.quantity), kind: 'SPICE' as const })),
        ]}
        productions={productions.map((p) => ({
          id: p.id,
          orderNo: p.orderNo,
          batchNo: p.batchNo,
          stage: stageOf(p.orderNo),
          stageDetail: p.stage,
          roastLevel: p.roastLevel,
          grindType: p.grindType,
          output: p.items.map((i) => `${i.product.name} ×${Number(i.quantity)}`).join('، '),
          inputWeight: Number(p.inputWeight),
          outputWeight: Number(p.outputWeight),
          expectedOutput: p.expectedOutput != null ? Number(p.expectedOutput) : null,
          wasteWeight: Number(p.wasteWeight),
          wastePercent: Number(p.wastePercent),
          wasteExceeded: p.wasteExceeded,
          channel: p.channel,
          createdAt: p.createdAt.toISOString(),
          status: p.status,
          outputProductName: p.items[0]?.product?.name || null,
          // بيانات التعبئة اللازمة للإقفال (بن + رول)
          gramsPerPiece: Number(p.items[0]?.product?.gramsPerPiece || 0),
          rollInputKg: p.rollInputKg != null ? Number(p.rollInputKg) : null,
          rollName: p.rollProductId ? (packagingAll.find((k) => k.id === p.rollProductId)?.name || null) : (p.items[0]?.product?.packaging?.name || null),
          rollTare: p.rollProductId
            ? Number(packagingAll.find((k) => k.id === p.rollProductId)?.tareWeight || 0)
            : Number(p.items[0]?.product?.packaging?.tareWeight || 0),
          rollCore: p.rollProductId
            ? Number(packagingAll.find((k) => k.id === p.rollProductId)?.estTareWeight || 0)
            : Number(p.items[0]?.product?.packaging?.estTareWeight || 0),
        }))}
        kpi={kpi}
      />
    </div>
  )
}
