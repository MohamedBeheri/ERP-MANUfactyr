import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

// تأكيد أمين المخزن إن أصناف أمر التحميل اتجهزت فعليًا — منفصل عن تأكيد استلام المندوب
// (المخزن بيجهّز الأول، والمندوب بعدين يستلم ويحرّك العربية عن طريق /confirm)
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth

  try {
    const order = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: { delegate: true },
    })
    if (!order) return NextResponse.json({ error: 'أمر التحميل غير موجود' }, { status: 404 })
    if (order.status !== 'PENDING') return NextResponse.json({ error: 'الأمر ده مش معلّق' }, { status: 400 })
    if (order.preparedAt) return NextResponse.json({ error: 'الأمر ده متجهز بالفعل' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      await tx.deliveryOrder.update({
        where: { id: order.id },
        data: { preparedAt: new Date(), preparedById: session.user.id },
      })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تجهيز أمر تحميل',
          description: `تم تجهيز أصناف أمر ${order.orderNo} (${order.delegate.name}) — جاهز لاستلام المندوب`,
          impact: 'موقف المخزن: اتجهز',
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل تسجيل التجهيز' }, { status: 500 })
  }
}
