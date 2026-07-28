import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(req: NextRequest) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response

  const settlementId = req.nextUrl.searchParams.get('settlementId')
  const delegateId = req.nextUrl.searchParams.get('delegateId')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  const whereSettlement: any = { status: 'ACCEPTED' }
  if (settlementId) whereSettlement.id = settlementId
  if (delegateId) whereSettlement.delegateId = delegateId
  if (from || to) {
    whereSettlement.acceptedAt = {}
    if (from) whereSettlement.acceptedAt.gte = new Date(from)
    if (to) whereSettlement.acceptedAt.lte = new Date(to + 'T23:59:59')
  }

  const settlements = await prisma.treasurySettlement.findMany({
    where: whereSettlement,
    include: {
      delegate: { select: { id: true, name: true } },
      deliveryOrder: {
        select: {
          id: true,
          orderNo: true,
          invoices: {
            select: {
              id: true,
              invoiceNo: true,
              customerId: true,
              customer: { select: { id: true, name: true, phone: true } },
              netAmount: true,
              paidAmount: true,
              type: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: { acceptedAt: 'desc' },
  })

  const collections = settlements.map((s) => {
    const invoices = s.deliveryOrder?.invoices || []
    const customerBreakdown = invoices.map((inv) => ({
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      customerId: inv.customerId,
      customerName: inv.customer?.name || 'عميل غير محدد',
      customerPhone: inv.customer?.phone,
      totalAmount: Number(inv.netAmount),
      paidAmount: Number(inv.paidAmount),
      creditAmount: Number(inv.netAmount) - Number(inv.paidAmount),
      paymentType: inv.type,
      date: inv.createdAt,
    }))
    return {
      settlementId: s.id,
      settlementNo: s.settlementNo,
      delegateName: s.delegate?.name,
      deliveryOrderNo: s.deliveryOrder?.orderNo,
      totalCash: Number(s.amount),
      acceptedAt: s.acceptedAt,
      customers: customerBreakdown,
      totalCollected: customerBreakdown.reduce((a, c) => a + c.paidAmount, 0),
      totalCredit: customerBreakdown.reduce((a, c) => a + c.creditAmount, 0),
    }
  })

  return NextResponse.json(collections)
}
