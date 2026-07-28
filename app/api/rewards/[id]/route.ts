import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('customers', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    const b = await req.json()
    const rule = await prisma.rewardRule.update({
      where: { id: params.id },
      data: {
        name: b.name?.trim() || undefined,
        productId: b.productId || undefined,
        buyQuantity: b.buyQuantity !== undefined ? Number(b.buyQuantity) : undefined,
        bundleSize: b.bundleSize !== undefined ? Number(b.bundleSize) || 1 : undefined,
        freeProductId: b.freeProductId || undefined,
        freeQuantity: b.freeQuantity !== undefined ? Number(b.freeQuantity) : undefined,
        repeat: b.repeat !== undefined ? !!b.repeat : undefined,
        tierId: b.tierId !== undefined ? b.tierId || null : undefined,
        isActive: b.isActive !== undefined ? !!b.isActive : undefined,
      },
    })
    return NextResponse.json(rule)
  } catch {
    return NextResponse.json({ error: 'فشل تعديل العرض' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('customers', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    // حذف ناعم للحفاظ على ربط الهدايا القديمة بالعرض
    const used = await prisma.invoiceItem.count({ where: { rewardRuleId: params.id } })
    if (used > 0) {
      await prisma.rewardRule.update({ where: { id: params.id }, data: { isActive: false } })
    } else {
      await prisma.rewardRule.delete({ where: { id: params.id } })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف العرض' }, { status: 500 })
  }
}
