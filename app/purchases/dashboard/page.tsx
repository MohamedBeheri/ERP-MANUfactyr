import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { ShoppingBag, Banknote, Clock, ReceiptText, Building2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, hasSectionAccess } from '@/lib/permissions'
import { PeriodSelector } from '@/components/period-selector'
import { GroupBarChart, TrendLineChart } from '@/components/group-charts'

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
  const days = Math.min(90, Math.max(1, Number(sp.days) || 30))
  const from = new Date(); from.setDate(from.getDate() - (days - 1)); from.setHours(0, 0, 0, 0)
  const to = new Date(); to.setHours(23, 59, 59, 999)
  return { from, to, days }
}

// لوحة تحكم المشتريات والموردين: مشتريات + مدفوع + مستحق + حسب المورد
export default async function PurchasesDashboardPage({ searchParams: raw }: { searchParams: Promise<{ days?: string; from?: string; to?: string }> }) {
  const sp = await raw
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!hasSectionAccess(perms, 'purchases')) redirect('/dashboard')

  const { from, to, days } = buildPeriod(sp)
  const period = { gte: from, lte: to }

  const [purchases, suppliers] = await Promise.all([
    prisma.purchase.findMany({ where: { createdAt: period }, include: { supplier: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.supplier.findMany({ where: { isActive: true }, select: { name: true, balance: true } }),
  ])

  const total = purchases.reduce((s, p) => s + Number(p.totalAmount), 0)
  const paid = purchases.reduce((s, p) => s + Number(p.paidAmount), 0)
  const outstanding = purchases.reduce((s, p) => s + (Number(p.totalAmount) - Number(p.paidAmount)), 0)
  const count = purchases.length
  const paidCount = purchases.filter((p) => p.paymentStatus === 'PAID').length
  const unpaidCount = purchases.filter((p) => p.paymentStatus === 'UNPAID').length
  const partialCount = purchases.filter((p) => p.paymentStatus === 'PARTIALLY_PAID').length
  const totalSupplierDebt = suppliers.reduce((s, sup) => s + Number(sup.balance), 0)

  // المشتريات حسب المورد
  const supMap = new Map<string, number>()
  for (const p of purchases) supMap.set(p.supplier.name, (supMap.get(p.supplier.name) || 0) + Number(p.totalAmount))
  const bySupplier = Array.from(supMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10)

  // مديونية الموردين (المستحق لكل مورد)
  const supplierDebt = suppliers.map((s) => ({ label: s.name, value: Number(s.balance) })).filter((s) => s.value > 0).sort((a, b) => b.value - a.value).slice(0, 10)

  // اتجاه المشتريات اليومي
  const dayKey = (d: Date) => d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
  const dayLabels: string[] = []
  const purchByDay: number[] = []
  const paidByDay: number[] = []
  const cursor = new Date(from)
  for (let i = 0; i < days; i++) {
    dayLabels.push(dayKey(cursor))
    const ds = new Date(cursor); ds.setHours(0, 0, 0, 0)
    const de = new Date(cursor); de.setHours(23, 59, 59, 999)
    const dayP = purchases.filter((p) => p.createdAt >= ds && p.createdAt <= de)
    purchByDay.push(dayP.reduce((s, p) => s + Number(p.totalAmount), 0))
    paidByDay.push(dayP.reduce((s, p) => s + Number(p.paidAmount), 0))
    cursor.setDate(cursor.getDate() + 1)
  }

  const kpis = [
    { label: 'إجمالي المشتريات', value: egp(total), Icon: ShoppingBag, cls: 'text-[#0f3460]', bg: 'bg-blue-50' },
    { label: 'المدفوع للموردين', value: egp(paid), Icon: Banknote, cls: 'text-green-700', bg: 'bg-green-50' },
    { label: 'المستحق (آجل) بالفترة', value: egp(outstanding), Icon: Clock, cls: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'عدد أوامر الشراء', value: fmt(count), Icon: ReceiptText, cls: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'مدفوعة بالكامل', value: fmt(paidCount), Icon: CheckCircle2, cls: 'text-green-700', bg: 'bg-green-50' },
    { label: 'جزئية / غير مدفوعة', value: `${fmt(partialCount)} / ${fmt(unpaidCount)}`, Icon: AlertTriangle, cls: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'إجمالي مديونية الموردين', value: egp(totalSupplierDebt), Icon: Building2, cls: 'text-red-600', bg: 'bg-red-50' },
    { label: 'عدد الموردين', value: fmt(suppliers.length), Icon: Building2, cls: 'text-sky-700', bg: 'bg-sky-50' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">لوحة تحكم المشتريات والموردين</h1>
          <p className="text-sm text-gray-500 mt-0.5">متابعة المشتريات والمدفوعات ومديونية الموردين برسومات وفلتر فترة</p>
        </div>
        <PeriodSelector current={sp.from && sp.to ? 0 : days} basePath="/purchases/dashboard" theme="light" />
      </div>

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

      <TrendLineChart
        title="اتجاه المشتريات والمدفوعات"
        subtitle="إجمالي المشتريات مقابل المدفوع للموردين يوميًا"
        labels={dayLabels}
        primary={{ label: 'المشتريات', data: purchByDay, color: '#0f3460' }}
        secondary={{ label: 'المدفوع', data: paidByDay, color: '#22c55e' }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GroupBarChart title="المشتريات حسب المورد" subtitle="أعلى الموردين شراءً في الفترة" items={bySupplier} color="#0f3460" emptyText="مفيش مشتريات في الفترة" />
        <GroupBarChart title="مديونية الموردين الحالية" subtitle="المستحق لكل مورد (مطلوب دفعه)" items={supplierDebt} color="#ef4444" emptyText="مفيش مديونية موردين" />
      </div>
    </div>
  )
}
