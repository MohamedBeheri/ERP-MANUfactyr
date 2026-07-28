import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { validateBlendPercents } from '@/lib/manufacturing'

export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('catalog', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    const b = await req.json()

    // وصفة التوليفة: مجموع نسب البن لازم = 100% — السيرفر يمنع الحفظ
    if (Array.isArray(b.components)) {
      const target = await prisma.product.findUnique({ where: { id: params.id }, select: { itemKind: true } })
      if (target?.itemKind === 'BLEND') {
        const invalid = validateBlendPercents(b.components.filter((c: any) => c.componentId))
        if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
      }
    }

    await prisma.product.update({
      where: { id: params.id },
      data: {
        name: b.name?.trim() || undefined,
        unit: b.unit || undefined,
        costPrice: b.costPrice !== undefined ? Number(b.costPrice) || 0 : undefined,
        sellPrice: b.sellPrice !== undefined ? Number(b.sellPrice) || 0 : undefined,
        oldPrice: b.oldPrice !== undefined ? (b.oldPrice ? Number(b.oldPrice) : null) : undefined,
        wholesalePrice: b.wholesalePrice !== undefined ? Number(b.wholesalePrice) || 0 : undefined,
        minKeyPrice: b.minKeyPrice !== undefined ? Number(b.minKeyPrice) || 0 : undefined,
        roastLossPercent: b.roastLossPercent !== undefined ? Number(b.roastLossPercent) || 0 : undefined,
        tareWeight: b.tareWeight !== undefined ? Number(b.tareWeight) || 0 : undefined,
        blendId: b.blendId !== undefined ? b.blendId || null : undefined,
        packagingId: b.packagingId !== undefined ? b.packagingId || null : undefined,
        gramsPerPiece: b.gramsPerPiece !== undefined ? Number(b.gramsPerPiece) || 0 : undefined,
        piecesPerBox: b.piecesPerBox !== undefined ? Number(b.piecesPerBox) || 1 : undefined,
        categoryId: b.categoryId !== undefined ? b.categoryId || null : undefined,
        stageId: b.stageId !== undefined ? b.stageId || undefined : undefined,
        minStock: b.minStock !== undefined ? Number(b.minStock) || 0 : undefined,
        imageUrl: b.imageUrl !== undefined ? b.imageUrl || null : undefined,
      },
    })

    // استبدال مكوّنات التوليفة لو اتبعتت
    if (Array.isArray(b.components)) {
      await prisma.blendComponent.deleteMany({ where: { blendId: params.id } })
      const clean = b.components.filter((c: any) => c.componentId)
      if (clean.length) {
        await prisma.blendComponent.createMany({
          data: clean.map((c: any) => ({
            blendId: params.id,
            componentId: c.componentId,
            percent: Number(c.percent) || 0,
            roastDegree: c.roastDegree || null,
            perKilo: Number(c.perKilo) || 0,
          })),
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل تعديل الصنف' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('catalog', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    await prisma.product.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف الصنف' }, { status: 500 })
  }
}
