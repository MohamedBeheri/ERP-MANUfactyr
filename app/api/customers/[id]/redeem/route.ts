import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

// استبدال نقاط البونص (1 نقطة = 1 ج.م خصم/كاش باك) — بيتخصم من رصيد العميل ويتوثق في سجل المراجعة
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const { points } = await req.json()
    const amount = Number(points)
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'أدخل عدد نقاط صحيح' }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({ where: { id: params.id } })
    if (!customer) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })
    if (Number(customer.bonusPoints) < amount) {
      return NextResponse.json(
        { error: `رصيد البونص غير كافي (المتاح: ${Number(customer.bonusPoints).toFixed(2)} نقطة)` },
        { status: 400 }
      )
    }

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: params.id },
        data: { bonusPoints: { decrement: amount } },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'استبدال بونص',
          description: `استبدال ${amount.toFixed(2)} نقطة بونص للعميل "${customer.name}"`,
          impact: `-${amount.toFixed(2)} نقطة`,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل استبدال البونص' }, { status: 500 })
  }
}
