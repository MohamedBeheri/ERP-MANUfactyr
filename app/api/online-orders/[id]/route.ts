import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { adjustStock, getStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

// تحديث حالة الطلب الأونلاين — التأكيد بيخصم من المخزن وينشئ فاتورة، الإلغاء بيرجّع الرصيد
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { status } = body
    const order = await prisma.onlineOrder.findUnique({
      where: { id: params.id },
      include: { items: true },
    })
    if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

    // تعديل بيانات الطلب (بدون تغيير حالة)
    if (!status) {
      const updated = await prisma.onlineOrder.update({
        where: { id: order.id },
        data: {
          customerName: body.customerName?.trim() || undefined,
          phone: body.phone?.trim() || undefined,
          address: body.address?.trim() || undefined,
          notes: body.notes !== undefined ? body.notes || null : undefined,
        },
      })
      return NextResponse.json(updated)
    }

    const warehouseId = order.warehouseId || (await warehouseForStage(null))
    const wasStockTaken = ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(order.status)
    const willTakeStock = ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(status)

    await prisma.$transaction(async (tx) => {
      // أول تأكيد: اخصم من المخزن + اعمل فاتورة بيع
      if (!wasStockTaken && willTakeStock) {
        for (const it of order.items) {
          const stock = await getStock(warehouseId, it.productId)
          if (stock < it.quantity) {
            throw new Error(`رصيد ${it.productName} مش كافي في المخزن`)
          }
        }
        const invoice = await tx.invoice.create({
          data: {
            invoiceNo: `INV-${Date.now()}`,
            customerId: order.customerId!,
            totalAmount: order.subtotal,
            discount: 0,
            netAmount: order.total,
            type: 'CASH',
            paymentMethod: 'الدفع عند الاستلام (أونلاين)',
            createdById: session.user.id,
            items: {
              create: order.items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                totalPrice: i.totalPrice,
              })),
            },
          },
        })
        for (const it of order.items) {
          await tx.product.update({ where: { id: it.productId }, data: { quantity: { decrement: it.quantity } } })
          await adjustStock(tx, warehouseId, it.productId, -it.quantity)
          await tx.warehouseOut.create({
            data: {
              productId: it.productId,
              warehouseId,
              quantity: it.quantity,
              target: `طلب أونلاين ${order.orderNo}`,
              reason: 'بيع أونلاين',
              createdById: session.user.id,
            },
          })
        }
        // بونص الفئة على طلبات الموقع عند التأكيد
        const buyer = await tx.customer.findUnique({ where: { id: order.customerId! }, include: { tier: true } })
        const bonusEarned = buyer?.tier ? (Number(order.total) * Number(buyer.tier.bonusPercent)) / 100 : 0
        await tx.customer.update({
          where: { id: order.customerId! },
          data: {
            totalPurchases: { increment: order.total },
            ...(bonusEarned > 0 ? { bonusPoints: { increment: bonusEarned } } : {}),
          },
        })
        await tx.onlineOrder.update({ where: { id: order.id }, data: { invoiceId: invoice.id } })
      }

      // إلغاء بعد ما اتخصم: رجّع الرصيد
      if (wasStockTaken && status === 'CANCELLED') {
        for (const it of order.items) {
          await tx.product.update({ where: { id: it.productId }, data: { quantity: { increment: it.quantity } } })
          await adjustStock(tx, warehouseId, it.productId, it.quantity)
          await tx.warehouseIn.create({
            data: {
              productId: it.productId,
              warehouseId,
              quantity: it.quantity,
              source: `إلغاء طلب أونلاين ${order.orderNo}`,
              createdById: session.user.id,
            },
          })
        }
      }

      await tx.onlineOrder.update({ where: { id: order.id }, data: { status } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تحديث الطلب' }, { status: 400 })
  }
}

// حذف طلب نهائيًا — لو المخزون كان اتخصم بيرجع الأول
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const order = await prisma.onlineOrder.findUnique({
      where: { id: params.id },
      include: { items: true },
    })
    if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

    const warehouseId = order.warehouseId || (await warehouseForStage(null))
    const stockTaken = ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(order.status)

    await prisma.$transaction(async (tx) => {
      if (stockTaken) {
        for (const it of order.items) {
          await tx.product.update({ where: { id: it.productId }, data: { quantity: { increment: it.quantity } } })
          await adjustStock(tx, warehouseId, it.productId, it.quantity)
          await tx.warehouseIn.create({
            data: {
              productId: it.productId,
              warehouseId,
              quantity: it.quantity,
              source: `حذف طلب أونلاين ${order.orderNo}`,
              createdById: session.user.id,
            },
          })
        }
      }
      await tx.onlineOrder.delete({ where: { id: order.id } })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف الطلب' }, { status: 500 })
  }
}
