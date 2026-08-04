import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { parseNum } from '@/lib/numbers'

// بداية الأسبوع الحالي (السبت) — أسبوع العمل المصري
function weekStart(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  // getDay: 0=الأحد ... 6=السبت — نرجع لآخر سبت
  const diff = (d.getDay() + 1) % 7
  d.setDate(d.getDate() - diff)
  return d
}

// GET: خطة الأسبوع + التحقيق الفعلي (عدد العملاء اللي اتعمل لهم فواتير الأسبوع ده)
export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('delegates', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams

  const [delegate, entries, weekInvoices] = await Promise.all([
    prisma.delegate.findUnique({ where: { id: params.id } }),
    prisma.routePlanEntry.findMany({
      where: { delegateId: params.id },
      include: { customer: { select: { id: true, name: true, area: true, phone: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.invoice.findMany({
      where: { delegateId: params.id, createdAt: { gte: weekStart() } },
      select: { customerId: true },
    }),
  ])
  if (!delegate) return NextResponse.json({ error: 'المندوب غير موجود' }, { status: 404 })

  const achievedCustomerIds = Array.from(new Set(weekInvoices.map((i) => i.customerId)))

  return NextResponse.json({
    weeklyCustomerTarget: Number(delegate.weeklyCustomerTarget),
    achievedThisWeek: achievedCustomerIds.length,
    achievedCustomerIds,
    entries: entries.map((e) => ({
      id: e.id,
      dayOfWeek: e.dayOfWeek,
      customerId: e.customerId,
      customerName: e.customer.name,
      customerArea: e.customer.area,
      customerPhone: e.customer.phone,
    })),
  })
}

// PUT: حفظ الخطة كاملة { weeklyCustomerTarget, days: { [dayOfWeek]: customerId[] } }
export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('delegates', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams

  try {
    const b = await req.json()
    const target = parseNum(b.weeklyCustomerTarget)
    const days: Record<string, string[]> = b.days || {}

    await prisma.$transaction(async (tx) => {
      await tx.delegate.update({
        where: { id: params.id },
        data: { weeklyCustomerTarget: target },
      })
      await tx.routePlanEntry.deleteMany({ where: { delegateId: params.id } })
      const rows: { delegateId: string; dayOfWeek: number; customerId: string; sortOrder: number }[] = []
      for (const [day, customerIds] of Object.entries(days)) {
        const d = Number(day)
        if (!(d >= 0 && d <= 6) || !Array.isArray(customerIds)) continue
        customerIds.forEach((cid, i) => {
          if (cid) rows.push({ delegateId: params.id, dayOfWeek: d, customerId: cid, sortOrder: i })
        })
      }
      // إزالة التكرار داخل نفس اليوم
      const seen = new Set<string>()
      const unique = rows.filter((r) => {
        const key = `${r.dayOfWeek}-${r.customerId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      if (unique.length) await tx.routePlanEntry.createMany({ data: unique })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل حفظ خط السير' }, { status: 500 })
  }
}
