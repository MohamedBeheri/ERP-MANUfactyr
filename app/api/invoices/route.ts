import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const invoices = await prisma.invoice.findMany({
      include: { customer: true, point: true, items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invoices)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { customerId, items, discount, type, pointId } = body

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'اختار عميل وأدخل صنف واحد على الأقل' }, { status: 400 })
    }

    // التحقق من رصيد المخزون قبل البيع
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) {
        return NextResponse.json({ error: 'صنف غير موجود' }, { status: 400 })
      }
      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `رصيد ${product.name} غير كافي (المتاح: ${product.quantity} ${product.unit})` },
          { status: 400 }
        )
      }
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0)
    const netAmount = totalAmount - (totalAmount * (discount || 0)) / 100

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNo: `INV-${Date.now()}`,
          customerId,
          totalAmount,
          discount: discount || 0,
          netAmount,
          type,
          pointId,
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
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: item.quantity } },
        })
        await tx.warehouseOut.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            target: `عميل - فاتورة ${created.invoiceNo}`,
            reason: 'فاتورة بيع',
            createdById: session.user.id,
          },
        })
      }

      if (type === 'CREDIT') {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: netAmount }, totalPurchases: { increment: netAmount } },
        })
      } else {
        await tx.customer.update({
          where: { id: customerId },
          data: { totalPurchases: { increment: netAmount } },
        })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'بيع',
          description: `فاتورة بيع ${created.invoiceNo}`,
          impact: `+${netAmount.toFixed(2)} ج.م`,
        },
      })

      return created
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
