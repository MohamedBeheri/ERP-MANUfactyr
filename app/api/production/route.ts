import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const productions = await prisma.production.findMany({
      include: { items: { include: { product: true } }, creator: true },
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
    const { rawUsed, opCost, items, notes } = body

    const production = await prisma.production.create({
      data: {
        orderNo: `PROD-${Date.now()}`,
        rawUsed,
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

    // Update product quantities
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      })
    }

    // Decrease raw material
    const rawProduct = await prisma.product.findFirst({ where: { type: 'RAW' } })
    if (rawProduct) {
      await prisma.product.update({
        where: { id: rawProduct.id },
        data: { quantity: { decrement: rawUsed } },
      })
    }

    // Create warehouse in entry
    for (const item of items) {
      await prisma.warehouseIn.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          source: `المصنع - أمر تصنيع ${production.orderNo}`,
          createdById: session.user.id,
        },
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'تصنيع',
        description: `أمر تصنيع ${production.orderNo}`,
        impact: `+${items.reduce((s: number, i: any) => s + i.quantity, 0)} علبة`,
      },
    })

    return NextResponse.json(production, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create production' }, { status: 500 })
  }
}
