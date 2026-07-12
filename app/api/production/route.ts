import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getDefaultWarehouseId, adjustStock, getStock } from '@/lib/warehouse'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const productions = await prisma.production.findMany({
      include: { items: { include: { product: true } }, rawProduct: true, creator: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(productions)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch production' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { rawProductId, rawUsed, stage, opCost, items, notes } = body
    const warehouseId = body.warehouseId || (await getDefaultWarehouseId())

    if (!rawProductId || !rawUsed || rawUsed <= 0) {
      return NextResponse.json({ error: 'اختار الخامة وأدخل كمية صحيحة' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'أدخل منتج ناتج واحد على الأقل' }, { status: 400 })
    }

    // التحقق من رصيد الخامة في المخزن المختار قبل التصنيع
    const rawProduct = await prisma.product.findUnique({ where: { id: rawProductId } })
    if (!rawProduct || rawProduct.type !== 'RAW') {
      return NextResponse.json({ error: 'الخامة المختارة غير موجودة' }, { status: 400 })
    }
    const rawStock = await getStock(warehouseId, rawProductId)
    if (rawStock < rawUsed) {
      return NextResponse.json(
        { error: `رصيد ${rawProduct.name} في المخزن ده غير كافي (المتاح: ${rawStock} ${rawProduct.unit})` },
        { status: 400 }
      )
    }

    const production = await prisma.$transaction(async (tx) => {
      const created = await tx.production.create({
        data: {
          orderNo: `PROD-${Date.now()}`,
          rawProductId,
          rawUsed,
          stage: stage || 'تحميص وطحن',
          opCost: opCost || 0,
          notes,
          createdById: session.user.id,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      })

      // خصم الخامة المستخدمة (البن الأخضر المختار) + إذن صرف
      await tx.product.update({
        where: { id: rawProductId },
        data: { quantity: { decrement: rawUsed } },
      })
      await adjustStock(tx, warehouseId, rawProductId, -rawUsed)
      await tx.warehouseOut.create({
        data: {
          productId: rawProductId,
          warehouseId,
          quantity: rawUsed,
          target: 'خط الإنتاج',
          reason: `أمر تصنيع ${created.orderNo} (${stage || 'تحميص وطحن'})`,
          createdById: session.user.id,
        },
      })

      // إضافة المنتجات الناتجة + إذن إضافة
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
        })
        await adjustStock(tx, warehouseId, item.productId, item.quantity)
        await tx.warehouseIn.create({
          data: {
            productId: item.productId,
            warehouseId,
            quantity: item.quantity,
            source: `المصنع - أمر تصنيع ${created.orderNo}`,
            createdById: session.user.id,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تصنيع',
          description: `أمر تصنيع ${created.orderNo} — ${rawProduct.name} (${rawUsed} ${rawProduct.unit})`,
          impact: `+${items.reduce((s: number, i: any) => s + i.quantity, 0)} وحدة منتج نهائي`,
        },
      })

      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create production' }, { status: 500 })
  }
}
