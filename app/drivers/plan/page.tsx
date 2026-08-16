import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const WEEK_DAYS: { day: number; label: string }[] = [
  { day: 6, label: 'السبت' }, { day: 0, label: 'الأحد' }, { day: 1, label: 'الإثنين' },
  { day: 2, label: 'الثلاثاء' }, { day: 3, label: 'الأربعاء' }, { day: 4, label: 'الخميس' }, { day: 5, label: 'الجمعة' },
]

export default async function MyPlanPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true }, select: { id: true } })
  if (!delegate) redirect('/drivers')

  const today = new Date().getDay()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const [plan, visitedToday] = await Promise.all([
    prisma.routePlanEntry.findMany({
      where: { delegateId: delegate.id },
      include: { customer: { select: { id: true, name: true, area: true, phone: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.invoice.findMany({ where: { delegateId: delegate.id, createdAt: { gte: todayStart } }, select: { customerId: true } }),
  ])
  const visitedIds = new Set(visitedToday.map((i) => i.customerId))
  const byDay = new Map<number, typeof plan>()
  for (const e of plan) { const l = byDay.get(e.dayOfWeek) || []; l.push(e); byDay.set(e.dayOfWeek, l) }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">خط سيري الأسبوعي</h1>
        <p className="text-sm text-gray-500 mt-0.5">العملاء المكلّف بزيارتهم كل يوم — مدير المبيعات بيحددهم</p>
      </div>
      {plan.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">مفيش خطة أسبوعية محددة لك لسه.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {WEEK_DAYS.map(({ day, label }) => {
            const list = byDay.get(day) || []
            const isToday = day === today
            return (
              <div key={day} className={`rounded-xl border overflow-hidden ${isToday ? 'border-[#0f3460] ring-1 ring-[#0f3460]/30' : 'border-gray-200'}`}>
                <div className={`flex items-center justify-between px-3 py-2 border-b ${isToday ? 'bg-[#0f3460] text-white border-[#0f3460]' : 'bg-gray-50 border-gray-100 text-[#1a1a2e]'}`}>
                  <span className="text-sm font-bold">{label}{isToday ? ' (النهارده)' : ''}</span>
                  <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 tabular-nums ${isToday ? 'bg-white/20' : 'bg-white border border-gray-200'}`}>{list.length}</span>
                </div>
                <div className="p-2 space-y-1 min-h-[48px]">
                  {list.length === 0 ? <p className="text-[11px] text-gray-300 text-center py-3">—</p> : list.map((e) => (
                    <div key={e.id} className={`text-xs rounded-lg px-2 py-1.5 ${visitedIds.has(e.customerId) && isToday ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}>
                      <span className="font-semibold flex items-center gap-1">{e.customer.name}</span>
                      {e.customer.area ? <span className="block text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{e.customer.area}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
