import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getDefaultWarehouseId } from '@/lib/warehouse'

const ALLOWED_ROLES = ['ADMIN', 'WAREHOUSE'] as const

// جرد مخزن معيّن: مقارنة الكمية الفعلية بالمسجلة في المخزن ده وتسوية الفرق
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { items, notes } = body as { items: { productId: string; countedQty: number }[]; notes?: string }
    const warehouseId = body.warehouseId || (await getDefaultWarehouseId())

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'أدخل كمية فعلية لصنف واحد على الأقل' }, { status: 400 })
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse) {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 400 })
    }

    const adjustments: { name: string; diff: number }[] = []

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) continue

        const stock = await tx.productStock.findUnique({
          where: { warehouseId_productId: { warehouseId, productId: item.productId } },
        })
        const recorded = stock?.quantity ?? 0
        const counted = Math.max(0, Math.floor(item.countedQty))
        const diff = counted - recorded
        if (diff === 0) continue

        // تحديث رصيد المخزن المحدد + الرصيد الإجمالي للصنف
        await tx.productStock.upsert({
          where: { warehouseId_productId: { warehouseId, productId: item.productId } },
          create: { warehouseId, productId: item.productId, quantity: counted },
          update: { quantity: counted },
        })
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: diff } },
        })

        if (diff > 0) {
          await tx.warehouseIn.create({
            data: {
              productId: item.productId,
              warehouseId,
              quantity: diff,
              source: `تسوية جرد (زيادة) - ${warehouse.name}`,
              notes,
              createdById: session.user.id,
            },
          })
        } else {
          await tx.warehouseOut.create({
            data: {
              productId: item.productId,
              warehouseId,
              quantity: -diff,
              target: `تسوية جرد - ${warehouse.name}`,
              reason: 'عجز جرد',
              notes,
              createdById: session.user.id,
            },
          })
        }

        adjustments.push({ name: product.name, diff })
      }

      if (adjustments.length > 0) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'جرد مخزن',
            description: `جرد ${warehouse.name} — تسوية ${adjustments.length} صنف: ${adjustments
              .map((a) => `${a.name} (${a.diff > 0 ? '+' : ''}${a.diff})`)
              .join('، ')}`,
            impact: `${adjustments.length} تسوية`,
          },
        })
      }
    })

    return NextResponse.json({ success: true, adjusted: adjustments.length })
  } catch (error) {
    return NextResponse.json({ error: 'فشلت عملية الجرد' }, { status: 500 })
  }
}
