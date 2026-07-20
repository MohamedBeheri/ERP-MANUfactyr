import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getDefaultWarehouseId, adjustStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const purchases = await prisma.purchase.findMany({
      include: { supplier: true, items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(purchases)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { supplierId, items, notes } = body
    const manualWarehouse = body.warehouseId || null

    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'اختار المورد وأدخل صنف واحد على الأقل' }, { status: 400 })
    }

    // كل صنف بيدخل مخزن مرحلته (الخام يدخل مخزن الخام) — إلا لو اختار المستخدم مخزن معين
    const productStages = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
      select: { id: true, stageId: true },
    })
    const stageOf = new Map(productStages.map((p) => [p.id, p.stageId]))
    const warehouseOf = async (productId: string) =>
      manualWarehouse || (await warehouseForStage(stageOf.get(productId)))

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0)

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          invoiceNo: `PUR-${Date.now()}`,
          supplierId,
          totalAmount,
          notes,
          createdById: session.user.id,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            })),
          },
        },
        include: { items: true },
      })

      for (const item of items) {
        const whId = await warehouseOf(item.productId)
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
        })
        await adjustStock(tx, whId, item.productId, item.quantity)
        await tx.warehouseIn.create({
          data: {
            productId: item.productId,
            warehouseId: whId,
            quantity: item.quantity,
            source: `أمر شراء ${created.invoiceNo}`,
            createdById: session.user.id,
          },
        })
      }

      await tx.supplier.update({
        where: { id: supplierId },
        data: { totalPurchases: { increment: totalAmount } },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'شراء',
          description: `فاتورة شراء ${created.invoiceNo}`,
          impact: `+${items.reduce((s: number, i: any) => s + i.quantity, 0)} للمخزن`,
        },
      })

      return created
    })

    return NextResponse.json(purchase, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 })
  }
}
