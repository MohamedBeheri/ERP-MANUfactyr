import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'view')
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || undefined
  const productId = searchParams.get('productId') || undefined

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(productId ? { productId } : {}),
    },
    include: {
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, unit: true } },
      creator: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(transfers)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'add')
  if ('response' in auth) return auth.response

  const { fromWarehouseId, toWarehouseId, productId, quantity, reason, notes } = await req.json()

  if (!fromWarehouseId || !toWarehouseId || !productId || !quantity || !reason) {
    return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
  }
  if (fromWarehouseId === toWarehouseId) {
    return NextResponse.json({ error: 'لا يمكن التحويل لنفس المخزن' }, { status: 400 })
  }
  if (quantity <= 0) {
    return NextResponse.json({ error: 'الكمية يجب أن تكون أكبر من صفر' }, { status: 400 })
  }

  const stock = await prisma.productStock.findUnique({
    where: { warehouseId_productId: { warehouseId: fromWarehouseId, productId } },
  })
  if (!stock || stock.quantity < quantity) {
    return NextResponse.json({ error: `الرصيد المتاح ${stock?.quantity ?? 0} — لا يكفي` }, { status: 400 })
  }

  const count = await prisma.stockTransfer.count()
  const transferNo = `TRF-${String(count + 1).padStart(5, '0')}`

  const transfer = await prisma.stockTransfer.create({
    data: {
      transferNo,
      fromWarehouseId,
      toWarehouseId,
      productId,
      quantity,
      reason,
      notes: notes || null,
      createdById: auth.session.user.id,
    },
    include: {
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, unit: true } },
      creator: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(transfer, { status: 201 })
}
