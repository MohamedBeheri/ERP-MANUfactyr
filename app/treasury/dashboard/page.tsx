import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Vault, TrendingUp, TrendingDown, Banknote, FileSpreadsheet, HandCoins,
  Scale, AlertTriangle, ChevronLeft, CircleDollarSign,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, hasSectionAccess } from '@/lib/permissions'
import { PeriodSelector } from '@/components/period-selector'
import { GroupBarChart } from '@/components/group-charts'
import { CashFlowChart } from '@/components/dashboard-charts'

export const dynamic = 'force-dynamic'

const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })

function buildPeriod(sp: { days?: string; from?: string; to?: string }) {
  if (sp.from && sp.to) {
    const from = new Date(sp.from); from.setHours(0, 0, 0, 0)
    const to = new Date(sp.to); to.setHours(23, 59, 59, 999)
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
    return { from, to, days }
  }
  const days = Math.min(90, Math.max(1, Number(sp.days) || 7))
  const from = new Date(); from.setDate(from.getDate() - (days - 1)); from.setHours(0, 0, 0, 0)
  const to = new Date(); to.setHours(23, 59, 59, 999)
  return { from, to, days }
}

// لوحة تحكم الخزينة والماليات: أرصدة الخزائن + حركة الفلوس + التحصيلات والمصروفات + العُهد والالتزامات
export default async function TreasuryDashboardPage({ searchParams: raw }: { searchParams: Promise<{ days?: string; from?: string; to?: string }> }) {
  const sp = await raw
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!hasSectionAccess(perms, 'treasury') && !hasSectionAccess(perms, 'finance')) redirect('/dashboard')

  const { from, to, days } = buildPeriod(sp)
  const period = { gte: from, lte: to }
  const now = new Date()

  const [
    treasuries, transactions, collections, vouchers,
    pendingSettlements, custodies, liabilities, overdueInstallments,
  ] = await Promise.all([
    prisma.treasury.findMany({ where: { isActive: true }, select: { name: true, type: true, balance: true } }),
    prisma.treasuryTransaction.findMany({ where: { createdAt: period }, select: { type: true, amount: true, createdAt: true, refType: true } }),
    prisma.collection.findMany({ where: { createdAt: period }, include: { paymentMethod: { select: { name: true } } } }),
    prisma.paymentVoucher.findMany({ where: { status: 'APPROVED', createdAt: period }, include: { category: { select: { name: true } } } }),
    prisma.treasurySettlement.count({ where: { status: 'PENDING' } }),
    prisma.custody.findMany({ where: { status: { in: ['PENDING', 'APPROVED', 'DISBURSED'] } }, select: { status: true, requestedAmount: true, approvedAmount: true } }),
    prisma.liability.findMany({ where: { status: { in: ['ACTIVE', 'OVERDUE'] } }, select: { remainingAmount: true } }),
    prisma.installment.count({ where: { status: { not: 'PAID' }, dueDate: { lt: now } } }),
  ])

  // ─── KPIs ───
  const totalBalance = treasuries.reduce((s, t) => s + Number(t.balance), 0)
  const inflow = transactions.filter((t) => t.type === 'IN').reduce((s, t) => s + Number(t.amount), 0)
  const outflow = transactions.filter((t) => t.type === 'OUT').reduce((s, t) => s + Number(t.amount), 0)
  const netFlow = inflow - outflow
  const collectionsTotal = collections.reduce((s, c) => s + Number(c.amount), 0)
  const expensesTotal = vouchers.reduce((s, v) => s + Number(v.amount), 0)
  const liabilitiesTotal = liabilities.reduce((s, l) => s + Number(l.remainingAmount), 0)
  const openCustodies = custodies.length
  const custodiesAmount = custodies.reduce((s, c) => s + Number(c.approvedAmount ?? c.requestedAmount), 0)

  // ─── حركة الخزائن اليومية (وارد/منصرف) ───
  const dayKey = (d: Date) => d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
  const dayLabels: string[] = []
  const inByDay: number[] = []
  const outByDay: number[] = []
  const cursor = new Date(from)
  for (let i = 0; i < days; i++) {
    dayLabels.push(dayKey(cursor))
    const ds = new Date(cursor); ds.setHours(0, 0, 0, 0)
    const de = new Date(cursor); de.setHours(23, 59, 59, 999)
    const dayTx = transactions.filter((t) => t.createdAt >= ds && t.createdAt <= de)
    inByDay.push(dayTx.filter((t) => t.type === 'IN').reduce((s, t) => s + Number(t.amount), 0))
    outByDay.push(dayTx.filter((t) => t.type === 'OUT').reduce((s, t) => s + Number(t.amount), 0))
    cursor.setDate(cursor.getDate() + 1)
  }

  // ─── أرصدة الخزائن ───
  const treasuryBalances = treasuries
    .map((t) => ({ label: t.name, value: Number(t.balance) }))
    .sort((a, b) => b.value - a.value)

  // ─── المصروفات حسب البند ───
  const byCategory = new Map<string, number>()
  for (const v of vouchers) {
    const key = v.category?.name || 'بدون بند'
    byCategory.set(key, (byCategory.get(key) || 0) + Number(v.amount))
  }
  const expensesList = Array.from(byCategory.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10)

  // ─── التحصيلات حسب وسيلة الدفع ───
  const byMethod = new Map<string, number>()
  for (const c of collections) {
    const key = c.paymentMethod.name
    byMethod.set(key, (byMethod.get(key) || 0) + Number(c.amount))
  }
  const collectionsList = Array.from(byMethod.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  // ─── تنبيهات محتاجة أكشن ───
  const alerts = [
    pendingSettlements > 0 && { href: '/treasury', text: `${fmt(pendingSettlements)} تسوية خزنة بانتظار الاعتماد`, cls: 'bg-amber-50 text-amber-700 ring-amber-100' },
    overdueInstallments > 0 && { href: '/treasury', text: `${fmt(overdueInstallments)} قسط متأخر عن السداد`, cls: 'bg-red-50 text-red-700 ring-red-100' },
    openCustodies > 0 && { href: '/treasury', text: `${fmt(openCustodies)} عُهدة مفتوحة (${egp(custodiesAmount)})`, cls: 'bg-blue-50 text-blue-700 ring-blue-100' },
  ].filter(Boolean) as { href: string; text: string; cls: string }[]

  const kpis = [
    { label: 'إجمالي أرصدة الخزائن', value: egp(totalBalance), Icon: Vault, cls: 'text-[#0f3460]', bg: 'bg-blue-50' },
    { label: 'وارد الفترة', value: egp(inflow), Icon: TrendingUp, cls: 'text-green-700', bg: 'bg-green-50' },
    { label: 'منصرف الفترة', value: egp(outflow), Icon: TrendingDown, cls: 'text-red-600', bg: 'bg-red-50' },
    { label: 'صافي الحركة', value: egp(netFlow), Icon: CircleDollarSign, cls: netFlow >= 0 ? 'text-emerald-700' : 'text-red-600', bg: netFlow >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'تحصيلات العملاء (الفترة)', value: egp(collectionsTotal), Icon: Banknote, cls: 'text-teal-700', bg: 'bg-teal-50' },
    { label: 'مصروفات معتمدة (الفترة)', value: egp(expensesTotal), Icon: FileSpreadsheet, cls: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'عُهد مفتوحة', value: `${fmt(openCustodies)} (${egp(custodiesAmount)})`, Icon: HandCoins, cls: 'text-purple-700', bg: 'bg-purple-50' },
    { label: 'التزامات متبقية', value: egp(liabilitiesTotal), Icon: Scale, cls: liabilitiesTotal > 0 ? 'text-red-600' : 'text-green-700', bg: 'bg-red-50' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">لوحة تحكم الخزينة والماليات</h1>
          <p className="text-sm text-gray-500 mt-0.5">أرصدة الخزائن وحركة الفلوس والتحصيلات والمصروفات والعُهد والالتزامات</p>
        </div>
        <PeriodSelector current={sp.from && sp.to ? 0 : days} basePath="/treasury/dashboard" theme="light" />
      </div>

      {alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.map((a) => (
            <Link key={a.text} href={a.href as any} className={`group flex items-center justify-between gap-3 p-3.5 rounded-xl ring-1 transition-all hover:-translate-y-0.5 ${a.cls}`}>
              <span className="flex items-center gap-2 text-xs font-bold"><AlertTriangle className="w-4 h-4 shrink-0" />{a.text}</span>
              <ChevronLeft className="w-4 h-4 shrink-0 group-hover:-translate-x-1 transition-transform" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}><k.Icon className={`w-5 h-5 ${k.cls}`} /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500">{k.label}</p>
              <p className={`text-base font-bold tabular-nums ${k.cls}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <CashFlowChart labels={dayLabels} inflows={inByDay} outflows={outByDay} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <GroupBarChart title="أرصدة الخزائن الحالية" subtitle="الرصيد الفعلي في كل خزنة دلوقتي" items={treasuryBalances} color="#0f3460" emptyText="مفيش خزائن نشطة" />
        <GroupBarChart title="المصروفات حسب البند" subtitle="سندات الصرف المعتمدة في الفترة" items={expensesList} color="#ef4444" emptyText="مفيش مصروفات معتمدة في الفترة" />
      </div>

      <GroupBarChart title="تحصيلات العملاء حسب وسيلة الدفع" subtitle="إجمالي التحصيل بكل وسيلة في الفترة" items={collectionsList} color="#10b981" emptyText="مفيش تحصيلات في الفترة" />
    </div>
  )
}
