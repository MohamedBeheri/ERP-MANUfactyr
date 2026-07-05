import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

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

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0)

    const purchase = await prisma.purchase.create({
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

    // Update product quantity
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'شراء',
        description: `فاتورة شراء ${purchase.invoiceNo}`,
        impact: `+${items.reduce((s: number, i: any) => s + i.quantity, 0)} كجم`,
      },
    })

    return NextResponse.json(purchase, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 })
  }
}
