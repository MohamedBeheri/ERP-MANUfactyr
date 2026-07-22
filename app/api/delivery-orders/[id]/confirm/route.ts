import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getDefaultWarehouseId, adjustStock, getStock } from '@/lib/warehouse'

const ALLOWED = ['ADMIN', 'SALES', 'DELEGATE'] as const

// تأكيد استلام حمولة العربية (مطابقة الاستلام) — البضاعة تخرج من المخزن فعليًا والعربية تتحرك.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const order = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: true } }, delegate: true },
    })
    if (!order) return NextResponse.json({ error: 'أمر التحميل غير موجود' }, { status: 404 })
    if (order.status !== 'PENDING') return NextResponse.json({ error: 'الأمر ده مش معلّق (اتأكد أو اتلغى قبل كده)' }, { status: 400 })

    // لو الداخل مندوب، لازم يكون هو صاحب الأمر
    if (session.user.role === 'DELEGATE' && order.delegate.userId !== session.user.id) {
      return NextResponse.json({ error: 'الأمر ده مش من حمولتك' }, { status: 403 })
    }

    const warehouseId = order.warehouseId || (await getDefaultWarehouseId())

    // إعادة التحقق من الرصيد وقت الاستلام (ممكن يكون اتغيّر)
    for (const it of order.items) {
      const stock = await getStock(warehouseId, it.productId)
      if (stock < it.quantity) {
        return NextResponse.json(
          { error: `رصيد ${it.product.name} في المخزن مبقاش كافي (المتاح: ${stock} / المطلوب: ${it.quantity})` },
          { status: 400 }
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const it of order.items) {
        await tx.product.update({ where: { id: it.productId }, data: { quantity: { decrement: it.quantity } } })
        await adjustStock(tx, warehouseId, it.productId, -it.quantity)
        await tx.warehouseOut.create({
          data: {
            productId: it.productId,
            warehouseId,
            quantity: it.quantity,
            target: `مندوب: ${order.delegate.name}`,
            reason: `استلام حمولة عربية - أمر ${order.orderNo}`,
            createdById: session.user.id,
          },
        })
      }
      await tx.deliveryOrder.update({ where: { id: order.id }, data: { status: 'IN_PROGRESS', receivedAt: new Date() } })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تأكيد استلام',
          description: `تأكيد استلام حمولة العربية - أمر ${order.orderNo} (${order.delegate.name})`,
          impact: `-${order.items.reduce((s, i) => s + i.quantity, 0)} من المخزن · العربية تحركت`,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل تأكيد الاستلام' }, { status: 500 })
  }
}
