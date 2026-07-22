import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    await prisma.product.update({
      where: { id: params.id },
      data: {
        name: b.name?.trim() || undefined,
        unit: b.unit || undefined,
        costPrice: b.costPrice !== undefined ? Number(b.costPrice) || 0 : undefined,
        sellPrice: b.sellPrice !== undefined ? Number(b.sellPrice) || 0 : undefined,
        wholesalePrice: b.wholesalePrice !== undefined ? Number(b.wholesalePrice) || 0 : undefined,
        roastLossPercent: b.roastLossPercent !== undefined ? Number(b.roastLossPercent) || 0 : undefined,
        tareWeight: b.tareWeight !== undefined ? Number(b.tareWeight) || 0 : undefined,
        blendId: b.blendId !== undefined ? b.blendId || null : undefined,
        packagingId: b.packagingId !== undefined ? b.packagingId || null : undefined,
        gramsPerPiece: b.gramsPerPiece !== undefined ? Number(b.gramsPerPiece) || 0 : undefined,
        piecesPerBox: b.piecesPerBox !== undefined ? Number(b.piecesPerBox) || 1 : undefined,
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    await prisma.product.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف الصنف' }, { status: 500 })
  }
}
