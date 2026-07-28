import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(req: NextRequest) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  const where: any = {}
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59')
  }

  const flows = await prisma.cashFlow.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      voucher: { select: { id: true, voucherNo: true, activity: true } },
    },
  })

  const grouped = {
    OPERATING: { inflow: 0, outflow: 0, items: [] as any[] },
    INVESTING: { inflow: 0, outflow: 0, items: [] as any[] },
    FINANCING: { inflow: 0, outflow: 0, items: [] as any[] },
  }

  for (const f of flows) {
    const act = f.activity || 'OPERATING'
    const bucket = grouped[act as keyof typeof grouped] || grouped.OPERATING
    const amt = Number(f.amount)
    if (f.type === 'IN') bucket.inflow += amt
    else bucket.outflow += amt
    bucket.items.push({
      id: f.id,
      description: f.description,
      type: f.type,
      amount: amt,
      reference: f.reference,
      activity: act,
      voucherNo: f.voucher?.voucherNo,
      createdAt: f.createdAt,
    })
  }

  const totalInflow = grouped.OPERATING.inflow + grouped.INVESTING.inflow + grouped.FINANCING.inflow
  const totalOutflow = grouped.OPERATING.outflow + grouped.INVESTING.outflow + grouped.FINANCING.outflow

  return NextResponse.json({
    operating: {
      label: 'أنشطة تشغيلية',
      inflow: grouped.OPERATING.inflow,
      outflow: grouped.OPERATING.outflow,
      net: grouped.OPERATING.inflow - grouped.OPERATING.outflow,
      items: grouped.OPERATING.items,
      affectsPL: true,
    },
    investing: {
      label: 'أنشطة استثمارية',
      inflow: grouped.INVESTING.inflow,
      outflow: grouped.INVESTING.outflow,
      net: grouped.INVESTING.inflow - grouped.INVESTING.outflow,
      items: grouped.INVESTING.items,
      affectsPL: false,
    },
    financing: {
      label: 'أنشطة تمويلية',
      inflow: grouped.FINANCING.inflow,
      outflow: grouped.FINANCING.outflow,
      net: grouped.FINANCING.inflow - grouped.FINANCING.outflow,
      items: grouped.FINANCING.items,
      affectsPL: false,
    },
    summary: {
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow - totalOutflow,
      operatingNet: grouped.OPERATING.inflow - grouped.OPERATING.outflow,
    },
  })
}
