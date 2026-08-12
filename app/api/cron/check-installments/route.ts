import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// يتم استدعاؤه يومياً (cron) لفحص الأقساط المستحقة وإنشاء إشعارات
// يمكن استدعاؤه يدوياً من الداشبورد أو عبر cron job خارجي
export async function GET(req: NextRequest) {
  // حماية بمفتاح سري — بيرفض دايمًا لو المفتاح مش متضبط (fail-closed مش fail-open)
  const secret = req.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const threeDaysFromNow = new Date(now)
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

  // أقساط مستحقة خلال 3 أيام ولم تُسدَّد
  const upcomingInstallments = await prisma.installment.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      dueDate: { lte: threeDaysFromNow },
    },
    include: { liability: true },
  })

  const notifications: { type: string; title: string; message: string; refId: string }[] = []

  for (const inst of upcomingInstallments) {
    const isOverdue = inst.dueDate < now
    const dueDateStr = inst.dueDate.toLocaleDateString('ar-EG')

    // تجنب تكرار الإشعارات — تحقق من عدم وجود إشعار مشابه اليوم
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const existing = await prisma.treasuryNotification.findFirst({
      where: {
        refId: inst.id,
        type: isOverdue ? 'INSTALLMENT_OVERDUE' : 'INSTALLMENT_DUE',
        createdAt: { gte: todayStart },
      },
    })
    if (existing) continue

    if (isOverdue) {
      // تحديث حالة القسط لـ OVERDUE
      await prisma.installment.update({
        where: { id: inst.id },
        data: { status: 'OVERDUE' },
      })
      notifications.push({
        type: 'INSTALLMENT_OVERDUE',
        title: `قسط متأخر — ${inst.liability.creditor}`,
        message: `القسط رقم ${inst.installmentNo} بمبلغ ${Number(inst.amount).toLocaleString('ar-EG')} ج.م كان مستحقاً في ${dueDateStr}`,
        refId: inst.id,
      })
    } else {
      notifications.push({
        type: 'INSTALLMENT_DUE',
        title: `قسط مستحق قريباً — ${inst.liability.creditor}`,
        message: `القسط رقم ${inst.installmentNo} بمبلغ ${Number(inst.amount).toLocaleString('ar-EG')} ج.م مستحق في ${dueDateStr}`,
        refId: inst.id,
      })
    }
  }

  // التزامات متأخرة بشكل عام
  const overdueLiabilities = await prisma.liability.findMany({
    where: {
      status: 'ACTIVE',
      dueDate: { lt: now },
    },
  })
  for (const lib of overdueLiabilities) {
    await prisma.liability.update({
      where: { id: lib.id },
      data: { status: 'OVERDUE' },
    })

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const existing = await prisma.treasuryNotification.findFirst({
      where: { refId: lib.id, type: 'LIABILITY_OVERDUE', createdAt: { gte: todayStart } },
    })
    if (!existing) {
      notifications.push({
        type: 'LIABILITY_OVERDUE',
        title: `التزام متأخر — ${lib.creditor}`,
        message: `الالتزام ${lib.liabilityNo} بمبلغ متبقي ${Number(lib.remainingAmount).toLocaleString('ar-EG')} ج.م تجاوز تاريخ السداد`,
        refId: lib.id,
      })
    }
  }

  // تسويات معلقة من أكثر من يوم
  const yesterdayStart = new Date(now)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const pendingSettlements = await prisma.treasurySettlement.findMany({
    where: { status: 'PENDING', createdAt: { lt: yesterdayStart } },
    include: { delegate: true },
  })
  for (const s of pendingSettlements) {
    const existing = await prisma.treasuryNotification.findFirst({
      where: { refId: s.id, type: 'SETTLEMENT_PENDING', createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } },
    })
    if (!existing) {
      notifications.push({
        type: 'SETTLEMENT_PENDING',
        title: `تسوية معلقة — ${s.delegate.name}`,
        message: `التسوية ${s.settlementNo} بمبلغ ${Number(s.amount).toLocaleString('ar-EG')} ج.م في انتظار اعتماد أمين الخزنة`,
        refId: s.id,
      })
    }
  }

  if (notifications.length > 0) {
    await prisma.treasuryNotification.createMany({ data: notifications })
  }

  return NextResponse.json({
    checked: upcomingInstallments.length,
    notificationsCreated: notifications.length,
    details: notifications,
  })
}
