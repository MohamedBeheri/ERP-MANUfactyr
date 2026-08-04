import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'view')
  if ('response' in auth) return auth.response

  const status = req.nextUrl.searchParams.get('status')
  const unloads = await prisma.unloadOrder.findMany({
    where: status ? { status: status as any } : {},
    include: {
      delegate: { include: { vehicle: true } },
      deliveryOrder: { select: { orderNo: true } },
      warehouse: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
      createdBy: { select: { name: true } },
      confirmedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(unloads)
}
