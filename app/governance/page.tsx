import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExportButtons } from '@/components/export-buttons'
import { GovernanceFilters } from '@/components/governance-filters'
import { LogIn } from 'lucide-react'

export const dynamic = 'force-dynamic'

// تصنيف عمليات سجل المراجعة لفئات — حسب نص الأكشن المسجّل
const CATEGORY_LABELS: Record<string, string> = {
  all: 'الكل',
  system: 'إعدادات النظام',
  auth: 'تسجيل الدخول',
  factory: 'التصنيع',
  warehouse: 'المخزن',
  delegates: 'المناديب',
  sales: 'المبيعات',
  purchases: 'المشتريات',
  treasury: 'الخزينة والعُهد',
  other: 'أخرى',
}

const ACTION_CATEGORY: Record<string, string> = {
  'مستخدم جديد': 'system', 'تعديل مستخدم': 'system', 'تعطيل مستخدم': 'system',
  'تسجيل دخول': 'auth',
  'تصنيع': 'factory', 'حذف تصنيع': 'factory', 'إنتاج توليفة': 'factory', 'طحن': 'factory',
  'بدء تحميص': 'factory', 'إقفال تحميص': 'factory', 'بدء طحن وتوليف': 'factory',
  'إقفال طحن وتوليف': 'factory', 'بدء تعبئة': 'factory', 'إقفال تعبئة': 'factory', 'تجاوز حد الهدر': 'factory',
  'جرد مخزن': 'warehouse', 'تأكيد تفريغ': 'warehouse',
  'أمر تحميل': 'delegates', 'تجهيز أمر تحميل': 'delegates', 'تأكيد استلام': 'delegates',
  'تسليم مندوب': 'delegates', 'تسليم': 'delegates', 'مرتجع جولة': 'delegates', 'تسوية': 'delegates',
  'بيع': 'sales', 'استبدال بونص': 'sales',
  'شراء': 'purchases', 'سند صرف مورد': 'purchases', 'طلبية إرسال': 'purchases', 'توريد فرع': 'purchases',
  'تحصيل': 'treasury', 'تحويل خزنة': 'treasury', 'تسوية إنستا باي': 'treasury',
  'طلب عهدة': 'treasury', 'اعتماد عهدة': 'treasury', 'رفض عهدة': 'treasury',
  'صرف عهدة': 'treasury', 'تسوية عهدة': 'treasury',
}
const categoryOf = (action: string) => ACTION_CATEGORY[action] || 'other'

export default async function GovernancePage({ searchParams: raw }: { searchParams: Promise<{ tab?: string; cat?: string; user?: string }> }) {
  const sp = await raw
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const tab = sp.tab === 'attendance' ? 'attendance' : 'log'
  const cat = sp.cat || ''
  const userId = sp.user || ''

  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)
  monthAgo.setHours(0, 0, 0, 0)

  const [users, auditLogs, activityLogs] = await Promise.all([
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.auditLog.findMany({
      where: userId ? { userId } : undefined,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    // آخر 30 يوم — للحضور (أول تسجيل دخول في اليوم) والانصراف (آخر نشاط مسجّل في اليوم)
    prisma.auditLog.findMany({
      where: { createdAt: { gte: monthAgo }, ...(userId ? { userId } : {}) },
      select: { userId: true, action: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // ─── تاب السجل: تصنيف وفلترة ───
  const categorized = auditLogs.map((l) => ({ ...l, category: categoryOf(l.action) }))
  const counts = new Map<string, number>()
  for (const l of categorized) counts.set(l.category, (counts.get(l.category) || 0) + 1)
  const categories = [
    { key: '', label: CATEGORY_LABELS.all, count: categorized.length },
    ...Object.keys(CATEGORY_LABELS)
      .filter((k) => k !== 'all' && (counts.get(k) || 0) > 0)
      .map((k) => ({ key: k, label: CATEGORY_LABELS[k], count: counts.get(k) || 0 })),
  ]
  const filteredLogs = cat ? categorized.filter((l) => l.category === cat) : categorized

  // ─── تاب الحضور: أول دخول + آخر نشاط لكل موظف/يوم ───
  type DayRow = { userName: string; day: string; dayDate: Date; firstLogin: Date | null; lastActivity: Date; logins: number }
  const byUserDay = new Map<string, DayRow>()
  for (const l of activityLogs) {
    const d = new Date(l.createdAt)
    const key = `${l.userId}|${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const row = byUserDay.get(key) || {
      userName: l.user.name,
      day: d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }),
      dayDate: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
      firstLogin: null as Date | null, lastActivity: d, logins: 0,
    }
    if (l.action === 'تسجيل دخول') {
      row.logins += 1
      if (!row.firstLogin || d < row.firstLogin) row.firstLogin = d
    }
    if (d > row.lastActivity) row.lastActivity = d
    byUserDay.set(key, row)
  }
  const attendanceRows = Array.from(byUserDay.values()).sort(
    (a, b) => b.dayDate.getTime() - a.dayDate.getTime() || a.userName.localeCompare(b.userName, 'ar')
  )

  const t = (d: Date) => d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

  const exportRows = tab === 'attendance'
    ? attendanceRows.map((r) => [r.userName, r.day, r.firstLogin ? t(r.firstLogin) : '—', t(r.lastActivity), String(r.logins)])
    : filteredLogs.map((log) => [log.action, log.user.name, log.description, log.impact, new Date(log.createdAt).toLocaleString('ar-EG')])
  const exportHeaders = tab === 'attendance'
    ? ['الموظف', 'اليوم', 'أول دخول (حضور)', 'آخر نشاط (انصراف)', 'مرات الدخول']
    : ['العملية', 'المستخدم', 'الوصف', 'التأثير', 'التاريخ']

  return (
    <div className="p-4 sm:p-6 space-y-6 print-area">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">الحوكمة</h1>
          <p className="text-sm text-gray-500 mt-0.5">سجل المراجعة بالفئات · لوج كل موظف · الحضور والانصراف من تسجيلات الدخول</p>
        </div>
        <ExportButtons
          fileName={tab === 'attendance' ? 'الحضور-والانصراف' : 'سجل-المراجعة'}
          headers={exportHeaders}
          rows={exportRows}
        />
      </div>

      <GovernanceFilters users={users} categories={categories} tab={tab} cat={cat} userId={userId} />

      {tab === 'log' ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredLogs.length === 0 && <p className="p-6 text-sm text-gray-500">مفيش عمليات مطابقة للفلتر.</p>}
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-600">{log.action}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">{CATEGORY_LABELS[log.category]}</span>
                    <span className="text-sm font-semibold text-[#1a1a2e]">{log.user.name}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{log.description}</p>
                  <p className="text-xs text-gray-400 mt-1">التأثير: {log.impact}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
                  {new Date(log.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3 flex-wrap">
            <LogIn className="w-4 h-4 text-[#0f3460]" />
            <h3 className="text-sm font-bold text-[#1a1a2e]">الحضور والانصراف — آخر 30 يوم</h3>
            <span className="text-[11px] text-gray-400">(الحضور = أول تسجيل دخول في اليوم · الانصراف = آخر نشاط مسجّل على النظام)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50 text-xs">
                  <th className="p-3 font-medium">الموظف</th>
                  <th className="p-3 font-medium">اليوم</th>
                  <th className="p-3 font-medium">أول دخول (حضور)</th>
                  <th className="p-3 font-medium">آخر نشاط (انصراف)</th>
                  <th className="p-3 font-medium">مرات الدخول</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400 text-sm">مفيش نشاط مسجّل في آخر 30 يوم.</td></tr>
                )}
                {attendanceRows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-semibold text-[#1a1a2e]">{r.userName}</td>
                    <td className="p-3 text-gray-600 text-xs">{r.day}</td>
                    <td className="p-3 tabular-nums">
                      {r.firstLogin
                        ? <span className="font-bold text-green-700">{t(r.firstLogin)}</span>
                        : <span className="text-gray-300 text-xs" title="نشاط بجلسة قديمة من غير تسجيل دخول جديد في اليوم ده">—</span>}
                    </td>
                    <td className="p-3 tabular-nums font-semibold text-[#0f3460]">{t(r.lastActivity)}</td>
                    <td className="p-3 tabular-nums text-gray-600">{r.logins.toLocaleString('ar-EG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
