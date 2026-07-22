import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getDefaultWarehouseId } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'

// حذف/عكس أمر تصنيع: بيرجّع المدخلات ويشيل المخرجات من المخزون (للأدمن)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const prod = await prisma.production.findUnique({
      where: { id: params.id },
      include: { inputs: { include: { product: true } }, items: { include: { product: true } } },
    })
    if (!prod) return NextResponse.json({ error: 'أمر التصنيع غير موجود' }, { status: 404 })

    const fallbackWh = await getDefaultWarehouseId()

    await prisma.$transaction(async (tx) => {
      // رجّع المدخلات
      for (const inp of prod.inputs) {
        const wh = inp.product.stageId ? await warehouseForStage(inp.product.stageId) : fallbackWh
        await tx.product.update({ where: { id: inp.productId }, data: { quantity: { increment: inp.quantity } } })
        await adjustStock(tx, wh, inp.productId, inp.quantity)
      }
      // شيل المخرجات
      for (const item of prod.items) {
        const wh = item.product.stageId ? await warehouseForStage(item.product.stageId) : fallbackWh
        await tx.product.update({ where: { id: item.productId }, data: { quantity: { decrement: item.quantity } } })
        await adjustStock(tx, wh, item.productId, -item.quantity)
      }
      await tx.production.delete({ where: { id: params.id } })
      await tx.auditLog.create({ data: { userId: session.user.id, action: 'حذف تصنيع', description: `عكس أمر التصنيع ${prod.orderNo}`, impact: 'رجّع المخزون لحالته' } })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف أمر التصنيع' }, { status: 500 })
  }
}
