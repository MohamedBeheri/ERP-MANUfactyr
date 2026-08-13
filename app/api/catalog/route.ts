import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { ensureStockStages } from '@/lib/stock-stages'
import { ensureUnits } from '@/lib/units'
import { validateBlendPercents } from '@/lib/manufacturing'
import { attachmentTooLarge } from '@/lib/security'

// المرحلة المخزنية المناسبة لكل نوع صنف (عشان الجرد والإنتاج يفضلوا شغالين)
async function stageForKind(kind: string): Promise<string | null> {
  const stages = await prisma.stockStage.findMany()
  const find = (kw: string) => stages.find((s) => s.name.includes(kw))?.id
  if (kind === 'FINISHED') return find('نهائي') || stages.find((s) => s.sellable)?.id || stages[0]?.id || null
  if (kind === 'BLEND') return find('مطحون') || find('محمّص') || stages[0]?.id || null
  if (kind === 'ROASTED') return find('محمّص') || stages[0]?.id || null
  if (kind === 'SPICE') return find('عطارة') || find('خام') || stages[0]?.id || null
  if (kind === 'FLAVOR') return find('نكهات') || find('عطارة') || find('خام') || stages[0]?.id || null
  if (kind === 'PACKAGING') return find('تغليف') || find('خام') || stages[0]?.id || null
  return find('خام') || stages.find((s) => s.purchasable)?.id || stages[0]?.id || null // GREEN
}

export async function GET() {
  const auth = await requirePermission('catalog', 'view')
  if ('response' in auth) return auth.response
  await ensureStockStages()
  await ensureUnits()

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
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    const stages = await prisma.stockStage.findMany({ orderBy: { sortOrder: 'asc' } })
    const units = await prisma.unit.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
    return NextResponse.json({
      items: products.map((p) => ({
        id: p.id,
        name: p.name,
        itemKind: p.itemKind,
        unit: p.unit,
        costPrice: Number(p.costPrice),
        sellPrice: Number(p.sellPrice),
        oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
        wholesalePrice: Number(p.wholesalePrice),
        minKeyPrice: Number(p.minKeyPrice),
        quantity: p.quantity,
        roastLossPercent: Number(p.roastLossPercent),
        tareWeight: Number(p.tareWeight),
        rollWeight: Number(p.rollWeight),
        estTareWeight: Number(p.estTareWeight),
        blendId: p.blendId,
        blendName: p.blend?.name || null,
        packagingId: p.packagingId,
        packagingName: p.packaging?.name || null,
        gramsPerPiece: Number(p.gramsPerPiece),
        piecesPerBox: p.piecesPerBox,
        categoryId: p.categoryId,
        stageId: p.stageId,
        imageUrl: p.imageUrl,
        minStock: p.minStock,
        showInPos: p.showInPos,
        showOnline: p.showOnline,
        isActive: p.isActive,
        components: p.blendComponents.map((c) => ({
          componentId: c.componentId,
          componentName: c.component.name,
          componentKind: c.component.itemKind,
          percent: Number(c.percent),
          roastDegree: c.roastDegree,
          perKilo: Number(c.perKilo),
        })),
      })),
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      stages: stages.map((s) => ({ id: s.id, name: s.name, sellable: s.sellable, purchasable: s.purchasable })),
      units: units.map((u) => ({ id: u.id, name: u.name })),
    })
  } catch {
    return NextResponse.json({ error: 'فشل جلب الأصناف' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('catalog', 'add')
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: 'اسم الصنف مطلوب' }, { status: 400 })
    const kind = ['GREEN', 'ROASTED', 'SPICE', 'FLAVOR', 'BLEND', 'PACKAGING', 'FINISHED'].includes(b.itemKind) ? b.itemKind : 'FINISHED'
    const stageId = b.stageId || await stageForKind(kind)

    if (kind === 'BLEND' && Array.isArray(b.components)) {
      const clean = b.components.filter((c: any) => c.componentId)
      const invalid = validateBlendPercents(clean)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    }

    { const _e = attachmentTooLarge(b.imageUrl); if (_e) return NextResponse.json({ error: _e }, { status: 413 }) }


    const product = await prisma.product.create({
      data: {
        name: b.name.trim(),
        type: kind === 'FINISHED' ? 'FINISHED' : 'RAW',
        itemKind: kind,
        stageId,
        categoryId: b.categoryId || null,
        unit: b.unit || (kind === 'FINISHED' ? 'علبة' : kind === 'PACKAGING' ? 'قطعة' : 'كجم'),
        costPrice: Number(b.costPrice) || 0,
        sellPrice: Number(b.sellPrice) || 0,
        oldPrice: b.oldPrice ? Number(b.oldPrice) : null,
        wholesalePrice: Number(b.wholesalePrice) || 0,
        minKeyPrice: Number(b.minKeyPrice) || 0,
        roastLossPercent: Number(b.roastLossPercent) || 0,
        tareWeight: Number(b.tareWeight) || 0,
        rollWeight: Number(b.rollWeight) || 0,
        estTareWeight: Number(b.estTareWeight) || 0,
        blendId: b.blendId || null,
        packagingId: b.packagingId || null,
        gramsPerPiece: Number(b.gramsPerPiece) || 0,
        piecesPerBox: Number(b.piecesPerBox) || 1,
        minStock: Number(b.minStock) || 0,
        imageUrl: b.imageUrl || null,
        showInPos: !!b.showInPos,
        showOnline: b.showOnline === undefined ? true : !!b.showOnline,
        ...(kind === 'BLEND' && Array.isArray(b.components)
          ? {
              blendComponents: {
                create: b.components
                  .filter((c: any) => c.componentId)
                  .map((c: any) => ({
                    componentId: c.componentId,
                    percent: Number(c.percent) || 0,
                    roastDegree: c.roastDegree || null,
                    perKilo: Number(c.perKilo) || 0,
                  })),
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
