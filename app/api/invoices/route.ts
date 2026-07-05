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

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0)
    const netAmount = totalAmount - (totalAmount * (discount || 0) / 100)

    const invoice = await prisma.invoice.create({
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

    // Update product quantities
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { quantity: { decrement: item.quantity } },
      })
    }

    // Update customer balance if credit
    if (type === 'CREDIT') {
      await prisma.customer.update({
        where: { id: customerId },
        data: { balance: { increment: netAmount }, totalPurchases: { increment: netAmount } },
      })
    } else {
      await prisma.customer.update({
        where: { id: customerId },
        data: { totalPurchases: { increment: netAmount } },
      })
    }

    // Create warehouse out entry
    for (const item of items) {
      await prisma.warehouseOut.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          target: `عميل - فاتورة ${invoice.invoiceNo}`,
          reason: 'فاتورة بيع',
          createdById: session.user.id,
        },
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'بيع',
        description: `فاتورة بيع ${invoice.invoiceNo}`,
        impact: `+${netAmount} ج.م`,
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
