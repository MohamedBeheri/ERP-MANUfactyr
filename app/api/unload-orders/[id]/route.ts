import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock, getDefaultWarehouseId } from '@/lib/warehouse'

// تأكيد/رفض استلام تفريغ العربية — أمين المخزن هو اللي بيدخّل البضاعة فعليًا
export async function PATCH(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth

  const { action } = await req.json()
  const unload = await prisma.unloadOrder.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { product: true } },
      delegate: { include: { vehicle: true } },
      deliveryOrder: { select: { orderNo: true } },
    },
  })
  if (!unload) return NextResponse.json({ error: 'أمر التفريغ غير موجود' }, { status: 404 })
  if (unload.status !== 'PENDING') {
    return NextResponse.json({ error: 'الأمر ده اتأكد أو اتلغى قبل كده' }, { status: 400 })
  }

  if (action === 'confirm') {
    const warehouseId = unload.warehouseId || (await getDefaultWarehouseId())
    const vanLabel = unload.delegate.vehicle?.plateNo || unload.delegate.carNumber || ''

    await prisma.$transaction(async (tx) => {
      for (const it of unload.items) {
        const qty = Number(it.quantity)
        await tx.product.update({ where: { id: it.productId }, data: { quantity: { increment: qty } } })
        await adjustStock(tx, warehouseId, it.productId, qty)
        await tx.warehouseIn.create({
          data: {
            productId: it.productId,
            warehouseId,
            quantity: qty,
            source: `تفريغ عربية - أمر ${unload.unloadNo} (مندوب: ${unload.delegate.name}${vanLabel ? ` — عربية ${vanLabel}` : ''}) · ${it.kind === 'RETURN' ? 'مرتجع عميل' : 'بواقي بيع'}`,
            createdById: session.user.id,
          },
        })
      }
      await tx.unloadOrder.update({
        where: { id: unload.id },
        data: { status: 'CONFIRMED', confirmedById: session.user.id, confirmedAt: new Date() },
      })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تأكيد تفريغ',
          description: `استلام تفريغ العربية - أمر ${unload.unloadNo} (${unload.delegate.name}${unload.deliveryOrder ? ` — جولة ${unload.deliveryOrder.orderNo}` : ''})`,
          impact: `+${unload.items.reduce((s, i) => s + Number(i.quantity), 0)} للمخزن`,
        },
      })
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'cancel') {
    await prisma.unloadOrder.update({
      where: { id: unload.id },
      data: { status: 'CANCELLED', confirmedById: session.user.id, confirmedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'action must be confirm or cancel' }, { status: 400 })
}
