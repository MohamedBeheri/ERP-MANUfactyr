import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { ensureStockStages } from '@/lib/stock-stages'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

// المرحلة المخزنية المناسبة لكل نوع صنف (عشان الجرد والإنتاج يفضلوا شغالين)
async function stageForKind(kind: string): Promise<string | null> {
  const stages = await prisma.stockStage.findMany()
  const find = (kw: string) => stages.find((s) => s.name.includes(kw))?.id
  if (kind === 'FINISHED') return find('نهائي') || stages.find((s) => s.sellable)?.id || stages[0]?.id || null
  if (kind === 'BLEND') return find('مطحون') || find('محمّص') || stages[0]?.id || null
  return find('خام') || stages.find((s) => s.purchasable)?.id || stages[0]?.id || null // GREEN/SPICE/FLAVOR/PACKAGING
}

export async function GET() {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  await ensureStockStages()

  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ itemKind: 'asc' }, { name: 'asc' }],
      include: {
        blend: { select: { id: true, name: true } },
        packaging: { select: { id: true, name: true } },
        blendComponents: { include: { component: { select: { id: true, name: true, itemKind: true } } } },
      },
    })
    return NextResponse.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        itemKind: p.itemKind,
        unit: p.unit,
        costPrice: Number(p.costPrice),
        sellPrice: Number(p.sellPrice),
        quantity: p.quantity,
        roastLossPercent: Number(p.roastLossPercent),
        tareWeight: Number(p.tareWeight),
        blendId: p.blendId,
        blendName: p.blend?.name || null,
        packagingId: p.packagingId,
        packagingName: p.packaging?.name || null,
        gramsPerPiece: Number(p.gramsPerPiece),
        piecesPerBox: p.piecesPerBox,
        components: p.blendComponents.map((c) => ({
          componentId: c.componentId,
          componentName: c.component.name,
          componentKind: c.component.itemKind,
          percent: Number(c.percent),
          perKilo: Number(c.perKilo),
        })),
      }))
    )
  } catch {
    return NextResponse.json({ error: 'فشل جلب الأصناف' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: 'اسم الصنف مطلوب' }, { status: 400 })
    const kind = ['GREEN', 'SPICE', 'FLAVOR', 'BLEND', 'PACKAGING', 'FINISHED'].includes(b.itemKind) ? b.itemKind : 'FINISHED'
    const stageId = await stageForKind(kind)

    const product = await prisma.product.create({
      data: {
        name: b.name.trim(),
        type: kind === 'FINISHED' ? 'FINISHED' : 'RAW',
        itemKind: kind,
        stageId,
        unit: b.unit || (kind === 'FINISHED' ? 'علبة' : kind === 'PACKAGING' ? 'قطعة' : 'كجم'),
        costPrice: Number(b.costPrice) || 0,
        sellPrice: Number(b.sellPrice) || 0,
        wholesalePrice: Number(b.wholesalePrice) || 0,
        roastLossPercent: Number(b.roastLossPercent) || 0,
        tareWeight: Number(b.tareWeight) || 0,
        blendId: b.blendId || null,
        packagingId: b.packagingId || null,
        gramsPerPiece: Number(b.gramsPerPiece) || 0,
        piecesPerBox: Number(b.piecesPerBox) || 1,
        ...(kind === 'BLEND' && Array.isArray(b.components)
          ? {
              blendComponents: {
                create: b.components
                  .filter((c: any) => c.componentId)
                  .map((c: any) => ({ componentId: c.componentId, percent: Number(c.percent) || 0, perKilo: Number(c.perKilo) || 0 })),
              },
            }
          : {}),
      },
    })
    return NextResponse.json(product, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إضافة الصنف' }, { status: 500 })
  }
}
