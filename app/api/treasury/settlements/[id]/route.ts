import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  const settlement = await prisma.treasurySettlement.findUnique({
    where: { id: params.id },
    include: {
      delegate: true,
      createdBy: { select: { id: true, name: true, role: true } },
      acceptedBy: { select: { id: true, name: true } },
    },
  })
  if (!settlement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(settlement)
}

// قبول أو رفض التسوية — أمين الخزنة أو المحاسب أو الأدمن
export async function PATCH(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;
  const { session } = auth

  const body = await req.json()
  const { action, rejectionReason } = body // action: "accept" | "reject"

  const settlement = await prisma.treasurySettlement.findUnique({ where: { id: params.id } })
  if (!settlement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (settlement.status !== 'PENDING') {
    return NextResponse.json({ error: 'التسوية تم التعامل معها بالفعل' }, { status: 400 })
  }

  if (action === 'accept') {
    const [updated] = await prisma.$transaction([
      prisma.treasurySettlement.update({
        where: { id: params.id },
        data: {
          status: 'ACCEPTED',
          acceptedById: (session.user as any).id,
          acceptedAt: new Date(),
        },
      }),
      prisma.cashFlow.create({
        data: {
          description: `تسوية خزنة ${settlement.settlementNo}`,
          type: 'IN',
          amount: settlement.amount,
          balance: 0,
          reference: settlement.settlementNo,
          activity: 'OPERATING',
        },
      }),
    ])
    return NextResponse.json(updated)
  }

  if (action === 'reject') {
    if (!rejectionReason) {
      return NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 })
    }
    const updated = await prisma.treasurySettlement.update({
      where: { id: params.id },
      data: { status: 'REJECTED', rejectionReason, acceptedById: (session.user as any).id },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
}
