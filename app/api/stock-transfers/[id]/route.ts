import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock } from '@/lib/warehouse'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response

  const { action } = await req.json()
  const transfer = await prisma.stockTransfer.findUnique({ where: { id: params.id } })
  if (!transfer) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  if (action === 'approve') {
    if (transfer.status !== 'PENDING') {
      return NextResponse.json({ error: 'لا يمكن الموافقة — الحالة الحالية: ' + transfer.status }, { status: 400 })
    }

    const stock = await prisma.productStock.findUnique({
      where: { warehouseId_productId: { warehouseId: transfer.fromWarehouseId, productId: transfer.productId } },
    })
    if (!stock || stock.quantity < transfer.quantity) {
      return NextResponse.json({ error: `الرصيد المتاح ${stock?.quantity ?? 0} — لا يكفي للتحويل` }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      await adjustStock(tx as any, transfer.fromWarehouseId, transfer.productId, -transfer.quantity)
      await adjustStock(tx as any, transfer.toWarehouseId, transfer.productId, transfer.quantity)

      await tx.warehouseOut.create({
        data: {
          productId: transfer.productId,
          warehouseId: transfer.fromWarehouseId,
          quantity: transfer.quantity,
          target: `تحويل → ${transfer.toWarehouseId}`,
          reason: `تحويل مخزني #${transfer.transferNo}`,
          createdById: auth.session.user.id,
        },
      })
      await tx.warehouseIn.create({
        data: {
          productId: transfer.productId,
          warehouseId: transfer.toWarehouseId,
          quantity: transfer.quantity,
          source: `تحويل ← ${transfer.fromWarehouseId}`,
          createdById: auth.session.user.id,
        },
      })

      return tx.stockTransfer.update({
        where: { id: params.id },
        data: {
          status: 'EXECUTED',
          approvedById: auth.session.user.id,
          executedAt: new Date(),
        },
      })
    })

    return NextResponse.json(updated)
  }

  if (action === 'reject') {
    if (transfer.status !== 'PENDING') {
      return NextResponse.json({ error: 'لا يمكن الرفض — الحالة الحالية: ' + transfer.status }, { status: 400 })
    }
    const updated = await prisma.stockTransfer.update({
      where: { id: params.id },
      data: { status: 'REJECTED', approvedById: auth.session.user.id },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
}
