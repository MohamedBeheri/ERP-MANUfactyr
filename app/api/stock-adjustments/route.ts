import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { getStock } from '@/lib/warehouse'
import { ensureGLAccounts, nextDocNo } from '@/lib/accounting'

// تسويات الجرد — قائمة + إنشاء مستند جديد (لقطة رصيد دفتري لحظة البدء)
export async function GET(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'view')
  if ('response' in auth) return auth.response
  const warehouseId = req.nextUrl.searchParams.get('warehouseId')
  const adjustments = await prisma.stockAdjustment.findMany({
    where: { ...(warehouseId ? { warehouseId } : {}) },
    include: {
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })
  return NextResponse.json(adjustments)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth
  await ensureGLAccounts()

  try {
    const b = await req.json()
    const warehouseId: string = b.warehouseId
    if (!warehouseId) return NextResponse.json({ error: 'اختار المخزن المستهدف' }, { status: 400 })
    const adjustmentType = ['SHORTAGE_ONLY', 'SURPLUS_ONLY', 'FULL'].includes(b.adjustmentType) ? b.adjustmentType : 'FULL'

    // لقطة الرصيد الدفتري لكل صنف له رصيد في المخزن + تكلفة الوحدة (WAC ≈ costPrice)
    const stocks = await prisma.productStock.findMany({
      where: { warehouseId },
      include: { product: { select: { id: true, name: true, costPrice: true, isActive: true } } },
    })
    const items = stocks
      .filter((s) => s.product.isActive)
      .map((s) => ({ productId: s.productId, snapshotQty: Number(s.quantity), unitCost: Number(s.product.costPrice) }))

    if (items.length === 0) return NextResponse.json({ error: 'المخزن ده مفيهوش أصناف برصيد للجرد' }, { status: 400 })

    const created = await prisma.$transaction(async (tx) => {
      const docNo = await nextDocNo(tx, 'ADJ', 'stockAdjustment')
      return tx.stockAdjustment.create({
        data: {
          docNo,
          stocktakeRef: b.stocktakeRef?.trim() || null,
          warehouseId,
          status: 'IN_PROGRESS',
          adjustmentType,
          reasonCode: b.reasonCode?.trim() || null,
          notes: b.notes?.trim() || null,
          createdById: session.user.id,
          items: {
            create: items.map((it) => ({
              productId: it.productId,
              snapshotQty: it.snapshotQty,
              unitCost: it.unitCost,
              countedQty: null,
              varianceQty: 0,
              varianceCost: 0,
              action: 'MATCHED',
            })),
          },
        },
        include: { items: true },
      })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل إنشاء مستند التسوية' }, { status: 500 })
  }
}
