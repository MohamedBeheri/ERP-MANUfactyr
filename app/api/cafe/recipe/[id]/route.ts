import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

// [id] = معرّف الصنف المباع (مشروب/ديزرت)

export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('cafe', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    const items = await prisma.cafeRecipeItem.findMany({
      where: { productId: params.id },
      include: { material: { select: { id: true, name: true, unit: true } } },
    })
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'فشل جلب التوليفة' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('cafe', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    const b = await req.json()
    const lines = Array.isArray(b.items) ? b.items.filter((l: any) => l.materialId && Number(l.quantity) > 0) : []

    await prisma.$transaction(async (tx) => {
      await tx.cafeRecipeItem.deleteMany({ where: { productId: params.id } })
      if (lines.length) {
        await tx.cafeRecipeItem.createMany({
          data: lines.map((l: any) => ({
            productId: params.id,
            materialId: l.materialId,
            quantity: Number(l.quantity),
          })),
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حفظ التوليفة' }, { status: 500 })
  }
}
