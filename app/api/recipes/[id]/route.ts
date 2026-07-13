import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const { name, lineType, outputName, roastLevel, grindType, expectedWaste, notes, items } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الوصفة مطلوب' }, { status: 400 })
    }
    const cleanItems = (Array.isArray(items) ? items : [])
      .filter((i: any) => i.productId && Number(i.percentage) > 0)
      .map((i: any) => ({ productId: i.productId, percentage: Number(i.percentage) }))

    if (cleanItems.length === 0) {
      return NextResponse.json({ error: 'أضف خامة واحدة على الأقل بنسبتها' }, { status: 400 })
    }
    const total = cleanItems.reduce((s: number, i: any) => s + i.percentage, 0)
    if (Math.abs(total - 100) > 0.5) {
      return NextResponse.json({ error: `مجموع النسب لازم يكون 100% (حاليًا ${total.toFixed(1)}%)` }, { status: 400 })
    }

    const recipe = await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { recipeId: params.id } })
      return tx.recipe.update({
        where: { id: params.id },
        data: {
          name: name.trim(),
          lineType: lineType === 'ROASTING' ? 'ROASTING' : 'PROCESSING',
          outputName: outputName || null,
          roastLevel: roastLevel || null,
          grindType: grindType || null,
          expectedWaste: Number(expectedWaste) || 0,
          notes: notes || null,
          items: { create: cleanItems },
        },
        include: { items: { include: { product: true } } },
      })
    })

    return NextResponse.json(recipe)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'اسم الوصفة ده موجود بالفعل' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    await prisma.recipe.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 })
  }
}
