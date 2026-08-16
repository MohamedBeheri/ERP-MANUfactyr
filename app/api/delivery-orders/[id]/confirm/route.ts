import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { getDefaultWarehouseId, adjustStock, getStock } from '@/lib/warehouse'


// تأكيد استلام حمولة العربية (مطابقة الاستلام) — البضاعة تخرج من المخزن فعليًا والعربية تتحرك.
// يقدر يأكّدها: الإدارة (صلاحية delegates:edit) أو المندوب صاحب الحمولة نفسه.
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
  const params = await rawParams

  try {
    const order = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: true } }, delegate: { include: { vehicle: true } } },
    })
    if (!order) return NextResponse.json({ error: 'أمر التحميل غير موجود' }, { status: 404 })

    // الصلاحية: الإدارة أو المندوب صاحب الحمولة
    const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
    const isOwner = order.delegate.userId === session.user.id
    if (!canDoAction(perms, 'delegates', 'edit') && !isOwner) {
      return NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 })
    }

    if (order.status !== 'PENDING') return NextResponse.json({ error: 'الأمر ده مش معلّق (اتأكد أو اتلغى قبل كده)' }, { status: 400 })
    if (!order.preparedAt) return NextResponse.json({ error: 'لسه المخزن ما جهّزش الأصناف — استنى تأكيد التجهيز الأول' }, { status: 400 })

    const warehouseId = order.warehouseId || (await getDefaultWarehouseId())

    // إعادة التحقق من الرصيد وقت الاستلام (ممكن يكون اتغيّر)
    for (const it of order.items) {
      const stock = await getStock(warehouseId, it.productId)
      if (stock < Number(it.quantity)) {
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
            target: `مندوب: ${order.delegate.name}${order.delegate.vehicle?.plateNo ? ` — عربية ${order.delegate.vehicle.plateNo}` : order.delegate.carNumber ? ` — عربية ${order.delegate.carNumber}` : ''}`,
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
          impact: `-${order.items.reduce((s, i) => s + Number(i.quantity), 0)} من المخزن · العربية تحركت`,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل تأكيد الاستلام' }, { status: 500 })
  }
}
