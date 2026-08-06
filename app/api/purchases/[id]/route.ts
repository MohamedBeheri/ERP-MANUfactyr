import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

export async function GET(_req: Request, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('purchases', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams

  const purchase = await prisma.purchase.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      items: { include: { product: true } },
      vouchers: {
        orderBy: { createdAt: 'desc' },
        include: { lines: { include: { paymentMethod: true, treasury: true } }, createdBy: { select: { name: true } } },
      },
    },
  })
  if (!purchase) return NextResponse.json({ error: 'فاتورة الشراء غير موجودة' }, { status: 404 })
  return NextResponse.json(purchase)
}
