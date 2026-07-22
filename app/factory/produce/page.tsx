import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureStockStages } from '@/lib/stock-stages'
import { FactoryProduction } from '@/components/factory-production'

export const dynamic = 'force-dynamic'

export default async function ProducePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  await ensureStockStages()

  const [blends, finished, productions] = await Promise.all([
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
    prisma.production.findMany({
      where: { orderNo: { startsWith: 'BLND-' } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { items: { include: { product: true } }, inputs: { include: { product: true } } },
    }).then(async (blnd) => {
      const pack = await prisma.production.findMany({
        where: { orderNo: { startsWith: 'PACK-' } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { items: { include: { product: true } }, inputs: { include: { product: true } } },
      })
      return [...blnd, ...pack].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20)
    }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/factory" className="p-2 text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 rounded-lg" aria-label="رجوع">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">أمر التصنيع</h1>
          <p className="text-sm text-gray-500 mt-0.5">إنتاج التوليفات من البن الأخضر (بخصم الخسران تلقائيًا) ثم التعبئة</p>
        </div>
      </div>

      <FactoryProduction
        blends={blends.map((b) => ({
          id: b.id,
          name: b.name,
          components: b.blendComponents.map((c) => ({
            name: c.component.name,
            kind: c.component.itemKind,
            percent: Number(c.percent),
            perKilo: Number(c.perKilo),
            roastLoss: Number(c.component.roastLossPercent),
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
          stage: p.stage,
          kind: p.orderNo.startsWith('PACK-') ? 'PACK' : 'BLEND',
          output: p.items.map((i) => `${i.product.name} ×${i.quantity}`).join('، '),
          inputWeight: p.inputWeight,
          wasteWeight: p.wasteWeight,
          wastePercent: Number(p.wastePercent),
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
