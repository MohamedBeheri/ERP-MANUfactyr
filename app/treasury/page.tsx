'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { TreasuriesHub } from '@/components/treasuries-hub'
import { CustodyPanel } from '@/components/custody-panel'
import {
  Vault, Plus, AlertTriangle, Clock,
  CreditCard, Landmark, Bell, BellOff, ChevronDown, ChevronUp,
  FileText, Banknote, TrendingDown, TrendingUp, Calendar,
  CircleDollarSign, CheckCircle2, XCircle, Filter,
  Receipt, Users, BarChart3, ArrowDownCircle, ArrowUpCircle,
  Settings2, Pencil, Trash2, ToggleLeft, ToggleRight, FolderTree, HandCoins,
} from 'lucide-react'

type Tab = 'treasuries' | 'settlements' | 'vouchers' | 'collections' | 'custodies' | 'liabilities' | 'cashflow' | 'notifications' | 'fin-settings'

const num = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'معلقة', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  ACCEPTED: { label: 'مقبولة', color: 'text-green-700', bg: 'bg-green-50' },
  REJECTED: { label: 'مرفوضة', color: 'text-red-700', bg: 'bg-red-50' },
  ACTIVE: { label: 'جارية', color: 'text-blue-700', bg: 'bg-blue-50' },
  SETTLED: { label: 'مسدّدة', color: 'text-green-700', bg: 'bg-green-50' },
  OVERDUE: { label: 'متأخرة', color: 'text-red-700', bg: 'bg-red-50' },
  CANCELLED: { label: 'ملغاة', color: 'text-gray-700', bg: 'bg-gray-50' },
  PAID: { label: 'مدفوع', color: 'text-green-700', bg: 'bg-green-50' },
  UNPAID: { label: 'غير مدفوع', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  PARTIALLY_PAID: { label: 'جزئي', color: 'text-orange-700', bg: 'bg-orange-50' },
  DRAFT: { label: 'مسودة', color: 'text-gray-700', bg: 'bg-gray-50' },
  APPROVED: { label: 'معتمد', color: 'text-green-700', bg: 'bg-green-50' },
}

const LIABILITY_TYPES: Record<string, string> = {
  LOAN: 'قرض بنكي',
  CHECK: 'شيك مستحق',
  INSTALLMENT_PLAN: 'تقسيط',
  FINANCING_COMPANY: 'شركة تمويل',
  REAL_ESTATE: 'عقارات',
  INSURANCE: 'تأمين على الحياة',
  OTHER: 'أخرى',
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'نقدي',
  CHECK: 'شيك',
  TRANSFER: 'تحويل بنكي',
}

const ACTIVITY_LABELS: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  OPERATING: { label: 'تشغيلي', color: 'text-blue-700', bg: 'bg-blue-50', desc: 'يؤثر على قائمة الدخل (P&L)' },
  INVESTING: { label: 'استثماري', color: 'text-purple-700', bg: 'bg-purple-50', desc: 'لا يؤثر على P&L — أصول/تأمين' },
  FINANCING: { label: 'تمويلي', color: 'text-teal-700', bg: 'bg-teal-50', desc: 'لا يؤثر على P&L — قروض/تسهيلات' },
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30 text-sm bg-white'

const VALID_TABS: Tab[] = ['treasuries', 'settlements', 'vouchers', 'collections', 'custodies', 'liabilities', 'cashflow', 'notifications', 'fin-settings']

// الصفحة ملفوفة في Suspense عشان useSearchParams (فتح تاب معيّن من القائمة الجانبية زي ?tab=fin-settings)
export default function TreasuryPage() {
  return (
    <Suspense>
      <TreasuryPageInner />
    </Suspense>
  )
}

function TreasuryPageInner() {
  const { can } = usePermissions()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('settlements')

  // فتح التاب المطلوب من اللينك (الإشعارات/الإعدادات المالية من القائمة الجانبية)
  useEffect(() => {
    const t = searchParams.get('tab') as Tab | null
    if (t && VALID_TABS.includes(t)) setTab(t)
  }, [searchParams])
  const [settlements, setSettlements] = useState<any[]>([])
  const [liabilities, setLiabilities] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [delegates, setDelegates] = useState<any[]>([])
  const [vouchers, setVouchers] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [treasuriesList, setTreasuriesList] = useState<any[]>([])
  const [cashflowReport, setCashflowReport] = useState<any>(null)
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewSettlement, setShowNewSettlement] = useState(false)
  const [showNewLiability, setShowNewLiability] = useState(false)
  const [showNewVoucher, setShowNewVoucher] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [expandedLiability, setExpandedLiability] = useState<string | null>(null)
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, lRes, nRes, dRes, vRes, cRes, cfRes, ecRes, tRes] = await Promise.all([
        fetch('/api/treasury/settlements'),
        fetch('/api/treasury/liabilities'),
        fetch('/api/treasury/notifications?unread=1'),
        fetch('/api/delegates'),
        fetch('/api/treasury/payment-vouchers'),
        fetch('/api/treasury/customer-collections'),
        fetch('/api/treasury/cashflow-report'),
        fetch('/api/treasury/expense-categories?all=1'),
        fetch('/api/treasury/treasuries'),
      ])
      const safe = async (r: Response) => { try { return await r.json() } catch { return null } }
      setSettlements(await safe(sRes) || [])
      setLiabilities(await safe(lRes) || [])
      setNotifications(await safe(nRes) || [])
      const dData = await safe(dRes)
      setDelegates(Array.isArray(dData) ? dData : [])
      setVouchers(await safe(vRes) || [])
      const cData = await safe(cRes)
      setCollections(Array.isArray(cData) ? cData : [])
      setCashflowReport(await safe(cfRes))
      const ecData = await safe(ecRes)
      setExpenseCategories(Array.isArray(ecData) ? ecData : [])
      const tData = await safe(tRes)
      setTreasuriesList(Array.isArray(tData) ? tData : (tData?.treasuries || []))
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // KPIs
  const totalSettlementsPending = settlements.filter((s: any) => s.status === 'PENDING').reduce((a: number, s: any) => a + Number(s.amount), 0)
  const totalSettlementsAccepted = settlements.filter((s: any) => s.status === 'ACCEPTED').reduce((a: number, s: any) => a + Number(s.amount), 0)
  const totalLiabilitiesRemaining = liabilities.reduce((a: number, l: any) => a + Number(l.remainingAmount), 0)
  const overdueCount = liabilities.filter((l: any) => l.status === 'OVERDUE').length
  const unreadNotifications = notifications.filter((n: any) => !n.isRead).length
  const totalVouchersOut = vouchers.reduce((a: number, v: any) => a + Number(v.amount), 0)

  // === Settlement Form ===
  const [sForm, setSForm] = useState({ delegateId: '', amount: '', method: 'CASH', checkNo: '', bankName: '', notes: '' })

  const submitSettlement = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const res = await fetch('/api/treasury/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sForm, amount: Number(sForm.amount) }),
    })
    setSubmitting(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'حصل خطأ'); return }
    setSForm({ delegateId: '', amount: '', method: 'CASH', checkNo: '', bankName: '', notes: '' })
    setShowNewSettlement(false)
    fetchData()
  }

  const handleSettlementAction = async (id: string, action: 'accept' | 'reject', reason?: string) => {
    const res = await fetch(`/api/treasury/settlements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rejectionReason: reason }),
    })
    if (res.ok) fetchData()
    else { const d = await res.json(); alert(d.error || 'حصل خطأ') }
  }

  // === Liability Form ===
  const [lForm, setLForm] = useState({ type: 'LOAN', creditor: '', totalAmount: '', interestRate: '0', startDate: '', dueDate: '', installmentsCount: '', notes: '' })

  const submitLiability = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const res = await fetch('/api/treasury/liabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...lForm,
        totalAmount: Number(lForm.totalAmount),
        interestRate: Number(lForm.interestRate),
        installmentsCount: lForm.installmentsCount ? Number(lForm.installmentsCount) : undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'حصل خطأ'); return }
    setLForm({ type: 'LOAN', creditor: '', totalAmount: '', interestRate: '0', startDate: '', dueDate: '', installmentsCount: '', notes: '' })
    setShowNewLiability(false)
    fetchData()
  }

  const payInstallment = async (liabilityId: string, installmentId: string) => {
    const res = await fetch(`/api/treasury/liabilities/${liabilityId}/installments/${installmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) fetchData()
    else { const d = await res.json(); alert(d.error || 'حصل خطأ') }
  }

  // === Payment Voucher Form ===
  const [vForm, setVForm] = useState({ description: '', amount: '', categoryId: '', activity: 'OPERATING', liabilityId: '', installmentId: '', paymentMethod: 'CASH', checkNo: '', bankName: '', notes: '', treasuryId: '' })

  // خزائن بيتصرف منها المصروفات فعليًا (لازم تكون مفعّلة للصرف)
  const disbursementTreasuries = treasuriesList.filter((t: any) => t.allowExpenseDisbursement)

  const submitVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!vForm.treasuryId) { setError('لازم تختار الخزنة اللي هيتصرف منها المبلغ'); return }
    setSubmitting(true)
    const res = await fetch('/api/treasury/payment-vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...vForm, amount: Number(vForm.amount) }),
    })
    setSubmitting(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'حصل خطأ'); return }
    setVForm({ description: '', amount: '', categoryId: '', activity: 'OPERATING', liabilityId: '', installmentId: '', paymentMethod: 'CASH', checkNo: '', bankName: '', notes: '', treasuryId: '' })
    setShowNewVoucher(false)
    fetchData()
  }

  const selectedLiability = liabilities.find((l: any) => l.id === vForm.liabilityId)
  const unpaidInstallments = selectedLiability?.installments?.filter((i: any) => i.status !== 'PAID') || []

  const markAllRead = async () => {
    await fetch('/api/treasury/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    fetchData()
  }

  // ============ Expense Category CRUD ============
  const [catForm, setCatForm] = useState({ name: '', code: '', activity: 'OPERATING', affectsPL: true, parentId: '' })

  const submitCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setError('')
    const res = await fetch('/api/treasury/expense-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...catForm, affectsPL: catForm.activity === 'OPERATING' ? catForm.affectsPL : false }),
    })
    setSubmitting(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'حصل خطأ'); return }
    setCatForm({ name: '', code: '', activity: 'OPERATING', affectsPL: true, parentId: '' })
    setShowNewCategory(false)
    fetchData()
  }

  const updateCategory = async (id: string, data: any) => {
    const res = await fetch(`/api/treasury/expense-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) { setEditingCategory(null); fetchData() }
    else { const d = await res.json(); setError(d.error || 'حصل خطأ') }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('حذف هذا البند نهائياً؟')) return
    const res = await fetch(`/api/treasury/expense-categories/${id}`, { method: 'DELETE' })
    if (res.ok) fetchData()
    else { const d = await res.json(); alert(d.error || 'لا يمكن الحذف') }
  }

  const activeCategories = expenseCategories.filter((c: any) => c.isActive && !c.parentId)

  const filteredSettlements = filterStatus ? settlements.filter((s: any) => s.status === filterStatus) : settlements
  const filteredLiabilities = filterStatus ? liabilities.filter((l: any) => l.status === filterStatus) : liabilities

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'treasuries', label: 'الخزائن والتحصيلات', icon: Vault },
    { key: 'settlements', label: 'تسويات الخزنة', icon: Banknote },
    { key: 'vouchers', label: 'سندات الصرف', icon: Receipt },
    { key: 'collections', label: 'تحصيلات العملاء', icon: Users },
    { key: 'custodies', label: 'عُهد الموظفين', icon: HandCoins },
    { key: 'liabilities', label: 'الالتزامات المالية', icon: Landmark },
    { key: 'cashflow', label: 'تقرير التدفقات', icon: BarChart3 },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <Vault className="w-7 h-7 text-[#0f3460]" />
            إدارة الخزنة والالتزامات
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">تسويات المناديب · سندات الصرف · التدفقات النقدية · القروض والأقساط</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'تسويات معلقة', value: num(totalSettlementsPending), icon: Clock, iconBg: 'bg-yellow-50', iconColor: 'text-yellow-600', valueColor: '' },
          { label: 'إجمالي المحصّل', value: num(totalSettlementsAccepted), icon: TrendingUp, iconBg: 'bg-green-50', iconColor: 'text-green-600', valueColor: 'text-green-700' },
          { label: 'سندات صرف', value: num(totalVouchersOut), icon: Receipt, iconBg: 'bg-orange-50', iconColor: 'text-orange-600', valueColor: 'text-orange-700' },
          { label: 'إجمالي الالتزامات', value: num(totalLiabilitiesRemaining), icon: TrendingDown, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', valueColor: 'text-blue-700' },
          { label: 'صافي التدفق', value: num(cashflowReport?.summary?.netCashFlow || 0), icon: BarChart3, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', valueColor: (cashflowReport?.summary?.netCashFlow || 0) >= 0 ? 'text-green-700' : 'text-red-700' },
          { label: 'التزامات متأخرة', value: String(overdueCount), icon: AlertTriangle, iconBg: overdueCount > 0 ? 'bg-red-50' : 'bg-green-50', iconColor: overdueCount > 0 ? 'text-red-600' : 'text-green-600', valueColor: overdueCount > 0 ? 'text-red-700' : 'text-green-700' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} flex items-center justify-center shrink-0`}>
              <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-lg font-bold tabular-nums ${kpi.valueColor}`}>{kpi.value}</p>
              <p className="text-[11px] text-gray-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setFilterStatus('') }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              tab === t.key ? 'bg-white text-[#0f3460] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count ? (
              <span className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400">جاري التحميل...</div>
      ) : (
        <>
          {/* ===== TREASURIES TAB ===== */}
          {tab === 'treasuries' && (
            <TreasuriesHub canAdd={can('treasury', 'add')} canEdit={can('treasury', 'edit')} />
          )}

          {/* ===== SETTLEMENTS TAB ===== */}
          {tab === 'settlements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
                    <option value="">كل الحالات</option>
                    <option value="PENDING">معلقة</option>
                    <option value="ACCEPTED">مقبولة</option>
                    <option value="REJECTED">مرفوضة</option>
                  </select>
                </div>
                {can('treasury', 'add') && (
                <button
                  onClick={() => { setShowNewSettlement(!showNewSettlement); setError('') }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-[#e9b44c] to-[#d9a43c] text-[#1a1a2e] rounded-xl text-sm font-bold hover:shadow-md transition-shadow"
                >
                  <Plus className="w-4 h-4" /> تسوية جديدة
                </button>
                )}
              </div>

              {can('treasury', 'add') && showNewSettlement && (
                <form onSubmit={submitSettlement} className="bg-white rounded-2xl shadow-sm p-5 space-y-4 border border-gray-100">
                  <h3 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-[#e9b44c]" /> تسوية خزنة جديدة
                  </h3>
                  {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select value={sForm.delegateId} onChange={(e) => setSForm({ ...sForm, delegateId: e.target.value })} className={inputCls} required>
                      <option value="">اختر المندوب</option>
                      {delegates.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <input type="text" inputMode="decimal" dir="ltr" min="0.01" step="0.01" placeholder="المبلغ" value={sForm.amount} onChange={(e) => setSForm({ ...sForm, amount: e.target.value })} className={inputCls} required />
                    <select value={sForm.method} onChange={(e) => setSForm({ ...sForm, method: e.target.value })} className={inputCls}>
                      <option value="CASH">نقدي</option>
                      <option value="CHECK">شيك</option>
                      <option value="TRANSFER">تحويل بنكي</option>
                    </select>
                  </div>
                  {sForm.method !== 'CASH' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sForm.method === 'CHECK' && (
                        <input placeholder="رقم الشيك" value={sForm.checkNo} onChange={(e) => setSForm({ ...sForm, checkNo: e.target.value })} className={inputCls} />
                      )}
                      <input placeholder="اسم البنك" value={sForm.bankName} onChange={(e) => setSForm({ ...sForm, bankName: e.target.value })} className={inputCls} />
                    </div>
                  )}
                  <input placeholder="ملاحظات (اختياري)" value={sForm.notes} onChange={(e) => setSForm({ ...sForm, notes: e.target.value })} className={inputCls} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-[#0f3460] text-white rounded-xl text-sm font-bold hover:bg-[#0a2545] disabled:opacity-50">
                      {submitting ? 'جاري الحفظ...' : 'تقديم التسوية'}
                    </button>
                    <button type="button" onClick={() => setShowNewSettlement(false)} className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm">إلغاء</button>
                  </div>
                </form>
              )}

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
                        <th className="px-4 py-3 font-medium">رقم التسوية</th>
                        <th className="px-4 py-3 font-medium">المندوب</th>
                        <th className="px-4 py-3 font-medium">الجولة</th>
                        <th className="px-4 py-3 font-medium">المبلغ</th>
                        <th className="px-4 py-3 font-medium">طريقة الدفع</th>
                        <th className="px-4 py-3 font-medium">الحالة</th>
                        <th className="px-4 py-3 font-medium">التاريخ</th>
                        <th className="px-4 py-3 font-medium">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSettlements.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">لا يوجد تسويات</td></tr>
                      )}
                      {filteredSettlements.map((s: any) => {
                        const st = STATUS_LABELS[s.status] || STATUS_LABELS.PENDING
                        return (
                          <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3"><span className="font-semibold tabular-nums text-xs text-[#0f3460]">{s.settlementNo}</span></td>
                            <td className="px-4 py-3 text-xs text-gray-700">{s.delegate?.name}</td>
                            <td className="px-4 py-3 text-xs tabular-nums text-[#0f3460]">{s.deliveryOrder?.orderNo || '—'}</td>
                            <td className="px-4 py-3">
                              <p className="font-bold tabular-nums text-sm">{num(s.amount)} ج.م</p>
                              {(Number(s.instapayAmount) > 0 || Number(s.walletAmount) > 0) && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Number(s.cashOnlyAmount) > 0 && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">كاش {num(s.cashOnlyAmount)}</span>}
                                  {Number(s.instapayAmount) > 0 && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">إنستا {num(s.instapayAmount)}</span>}
                                  {Number(s.walletAmount) > 0 && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold tabular-nums">محفظة {num(s.walletAmount)}</span>}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{METHOD_LABELS[s.method] || s.method}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${st.bg} ${st.color}`}>{st.label}</span>
                              {s.rejectionReason && <p className="text-[10px] text-red-500 mt-0.5">{s.rejectionReason}</p>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</td>
                            <td className="px-4 py-3">
                              {s.status === 'PENDING' && (
                                <div className="flex gap-1">
                                  <button onClick={() => handleSettlementAction(s.id, 'accept')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="قبول">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => { const reason = prompt('سبب الرفض:'); if (reason) handleSettlementAction(s.id, 'reject', reason) }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="رفض"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                              {s.status === 'ACCEPTED' && s.acceptedBy && (
                                <span className="text-[10px] text-gray-400">اعتمد: {s.acceptedBy.name}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== PAYMENT VOUCHERS TAB ===== */}
          {tab === 'vouchers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-gray-500">سندات الصرف — تُخصم من الخزينة وتُسجّل في قائمة التدفقات حسب نوع النشاط</p>
                <button
                  onClick={() => { setShowNewVoucher(!showNewVoucher); setError('') }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-[#e9b44c] to-[#d9a43c] text-[#1a1a2e] rounded-xl text-sm font-bold hover:shadow-md transition-shadow"
                >
                  <Plus className="w-4 h-4" /> سند صرف جديد
                </button>
              </div>

              {showNewVoucher && (
                <form onSubmit={submitVoucher} className="bg-white rounded-2xl shadow-sm p-5 space-y-4 border border-gray-100">
                  <h3 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#e9b44c]" /> سند صرف جديد
                  </h3>
                  {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">الخزنة اللي هيتصرف منها <span className="text-red-500">*</span></label>
                    {disbursementTreasuries.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs leading-relaxed">
                        مفيش خزنة مفعّلة للصرف حاليًا. روح لتبويب «الخزائن» وفعّل «السماح بصرف المصروفات» على خزنة واحدة على الأقل عشان تقدر تعمل سند صرف.
                      </div>
                    ) : (
                      <select value={vForm.treasuryId} onChange={(e) => setVForm({ ...vForm, treasuryId: e.target.value })} className={inputCls} required>
                        <option value="">اختر الخزنة —</option>
                        {disbursementTreasuries.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name} — الرصيد: {num(t.balance)} ج.م</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <select
                      value={vForm.categoryId}
                      onChange={(e) => {
                        const cat = expenseCategories.find((c: any) => c.id === e.target.value)
                        setVForm({ ...vForm, categoryId: e.target.value, activity: cat?.activity || vForm.activity })
                      }}
                      className={inputCls}
                    >
                      <option value="">بند المصروف (اختياري)</option>
                      {(() => {
                        const ops = expenseCategories.filter((c: any) => c.isActive && c.activity === 'OPERATING' && !c.parentId)
                        const inv = expenseCategories.filter((c: any) => c.isActive && c.activity === 'INVESTING' && !c.parentId)
                        const fin = expenseCategories.filter((c: any) => c.isActive && c.activity === 'FINANCING' && !c.parentId)
                        return (
                          <>
                            {ops.length > 0 && <optgroup label="تشغيلي">{ops.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}</optgroup>}
                            {inv.length > 0 && <optgroup label="استثماري">{inv.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}</optgroup>}
                            {fin.length > 0 && <optgroup label="تمويلي">{fin.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}</optgroup>}
                          </>
                        )
                      })()}
                    </select>
                    <input placeholder="وصف السند" value={vForm.description} onChange={(e) => setVForm({ ...vForm, description: e.target.value })} className={inputCls} required />
                    <input type="text" inputMode="decimal" dir="ltr" min="0.01" step="0.01" placeholder="المبلغ" value={vForm.amount} onChange={(e) => setVForm({ ...vForm, amount: e.target.value })} className={inputCls} required />
                    <select value={vForm.activity} onChange={(e) => setVForm({ ...vForm, activity: e.target.value })} className={inputCls}>
                      <option value="OPERATING">تشغيلي — يدخل P&L</option>
                      <option value="INVESTING">استثماري — لا يدخل P&L</option>
                      <option value="FINANCING">تمويلي — لا يدخل P&L</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={vForm.liabilityId}
                      onChange={(e) => setVForm({ ...vForm, liabilityId: e.target.value, installmentId: '' })}
                      className={inputCls}
                    >
                      <option value="">ربط بالتزام (اختياري)</option>
                      {liabilities.filter((l: any) => l.status !== 'SETTLED').map((l: any) => (
                        <option key={l.id} value={l.id}>{l.liabilityNo} — {l.creditor} ({LIABILITY_TYPES[l.type]})</option>
                      ))}
                    </select>
                    {unpaidInstallments.length > 0 && (
                      <select value={vForm.installmentId} onChange={(e) => setVForm({ ...vForm, installmentId: e.target.value })} className={inputCls}>
                        <option value="">ربط بقسط (اختياري)</option>
                        {unpaidInstallments.map((i: any) => (
                          <option key={i.id} value={i.id}>قسط #{i.installmentNo} — {num(i.amount)} ج.م (استحقاق {new Date(i.dueDate).toLocaleDateString('ar-EG')})</option>
                        ))}
                      </select>
                    )}
                    <select value={vForm.paymentMethod} onChange={(e) => setVForm({ ...vForm, paymentMethod: e.target.value })} className={inputCls}>
                      <option value="CASH">نقدي</option>
                      <option value="CHECK">شيك</option>
                      <option value="TRANSFER">تحويل بنكي</option>
                    </select>
                  </div>
                  {vForm.paymentMethod !== 'CASH' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {vForm.paymentMethod === 'CHECK' && (
                        <input placeholder="رقم الشيك" value={vForm.checkNo} onChange={(e) => setVForm({ ...vForm, checkNo: e.target.value })} className={inputCls} />
                      )}
                      <input placeholder="اسم البنك" value={vForm.bankName} onChange={(e) => setVForm({ ...vForm, bankName: e.target.value })} className={inputCls} />
                    </div>
                  )}
                  <input placeholder="ملاحظات (اختياري)" value={vForm.notes} onChange={(e) => setVForm({ ...vForm, notes: e.target.value })} className={inputCls} />

                  {vForm.activity !== 'OPERATING' && (
                    <div className={`p-3 rounded-lg text-xs ${ACTIVITY_LABELS[vForm.activity]?.bg} ${ACTIVITY_LABELS[vForm.activity]?.color}`}>
                      {ACTIVITY_LABELS[vForm.activity]?.desc} — المبلغ يُخصم من الخزينة مباشرة ويظهر في الميزانية العمومية فقط
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-[#0f3460] text-white rounded-xl text-sm font-bold hover:bg-[#0a2545] disabled:opacity-50">
                      {submitting ? 'جاري الحفظ...' : 'اعتماد وصرف'}
                    </button>
                    <button type="button" onClick={() => setShowNewVoucher(false)} className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm">إلغاء</button>
                  </div>
                </form>
              )}

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
                        <th className="px-4 py-3 font-medium">رقم السند</th>
                        <th className="px-4 py-3 font-medium">البند</th>
                        <th className="px-4 py-3 font-medium">الوصف</th>
                        <th className="px-4 py-3 font-medium">المبلغ</th>
                        <th className="px-4 py-3 font-medium">نوع النشاط</th>
                        <th className="px-4 py-3 font-medium">الالتزام</th>
                        <th className="px-4 py-3 font-medium">طريقة الدفع</th>
                        <th className="px-4 py-3 font-medium">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">لا يوجد سندات صرف</td></tr>
                      )}
                      {vouchers.map((v: any) => {
                        const act = ACTIVITY_LABELS[v.activity] || ACTIVITY_LABELS.OPERATING
                        return (
                          <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3"><span className="font-semibold tabular-nums text-xs text-[#0f3460]">{v.voucherNo}</span></td>
                            <td className="px-4 py-3 text-xs text-gray-600">{v.category?.name || '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-700 max-w-[200px] truncate">{v.description}</td>
                            <td className="px-4 py-3 font-bold tabular-nums text-sm text-red-600">{num(v.amount)} ج.م</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${act.bg} ${act.color}`}>{act.label}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {v.liability ? (
                                <span>{v.liability.liabilityNo} — {v.liability.creditor}</span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{METHOD_LABELS[v.paymentMethod] || v.paymentMethod}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{new Date(v.createdAt).toLocaleDateString('ar-EG')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== CUSTOMER COLLECTIONS TAB ===== */}
          {tab === 'collections' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">تفاصيل المبالغ المحصلة من كل عميل — لتأكيد تسقيط المبالغ من حسابات العملاء</p>
              {collections.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                  <Users className="w-8 h-8 text-gray-300" />
                  لا يوجد تحصيلات مُعتمدة بعد
                </div>
              )}
              {collections.map((c: any) => {
                const expanded = expandedCollection === c.settlementId
                return (
                  <div key={c.settlementId} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    <div
                      className="p-4 sm:p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                      onClick={() => setExpandedCollection(expanded ? null : c.settlementId)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#0f3460] tabular-nums">{c.settlementNo}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-semibold">مُعتمدة</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">المندوب: <span className="font-semibold">{c.delegateName}</span> · الجولة: <span className="tabular-nums">{c.deliveryOrderNo || '—'}</span></p>
                          {c.acceptedAt && (
                            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(c.acceptedAt).toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-lg font-bold tabular-nums text-green-700">{num(c.totalCollected)} ج.م</p>
                          {c.totalCredit > 0 && <p className="text-[11px] text-orange-500">آجل: {num(c.totalCredit)} ج.م</p>}
                        </div>
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
                      </div>
                    </div>

                    {expanded && c.customers.length > 0 && (
                      <div className="border-t border-gray-100 px-4 sm:px-5 py-3">
                        <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> تفصيل العملاء ({c.customers.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 border-b text-right">
                                <th className="pb-2 font-medium">العميل</th>
                                <th className="pb-2 font-medium">الفاتورة</th>
                                <th className="pb-2 font-medium">الإجمالي</th>
                                <th className="pb-2 font-medium">المدفوع</th>
                                <th className="pb-2 font-medium">الآجل</th>
                                <th className="pb-2 font-medium">النوع</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.customers.map((cust: any, i: number) => (
                                <tr key={i} className="border-b border-gray-50 last:border-0">
                                  <td className="py-2 font-semibold text-gray-700">{cust.customerName}</td>
                                  <td className="py-2 tabular-nums text-[#0f3460]">{cust.invoiceNo}</td>
                                  <td className="py-2 tabular-nums font-bold">{num(cust.totalAmount)}</td>
                                  <td className="py-2 tabular-nums text-green-600 font-semibold">{num(cust.paidAmount)}</td>
                                  <td className="py-2 tabular-nums text-orange-600">{cust.creditAmount > 0 ? num(cust.creditAmount) : '—'}</td>
                                  <td className="py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cust.paymentType === 'CASH' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                                      {cust.paymentType === 'CASH' ? 'نقدي' : 'آجل'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {expanded && c.customers.length === 0 && (
                      <div className="border-t border-gray-100 px-5 py-4 text-xs text-gray-400 text-center">
                        لا يوجد فواتير مرتبطة بهذه التسوية
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ===== LIABILITIES TAB ===== */}
          {tab === 'liabilities' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
                    <option value="">كل الحالات</option>
                    <option value="ACTIVE">جارية</option>
                    <option value="OVERDUE">متأخرة</option>
                    <option value="SETTLED">مسدّدة</option>
                  </select>
                </div>
                <button
                  onClick={() => { setShowNewLiability(!showNewLiability); setError('') }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-[#e9b44c] to-[#d9a43c] text-[#1a1a2e] rounded-xl text-sm font-bold hover:shadow-md transition-shadow"
                >
                  <Plus className="w-4 h-4" /> التزام جديد
                </button>
              </div>

              {showNewLiability && (
                <form onSubmit={submitLiability} className="bg-white rounded-2xl shadow-sm p-5 space-y-4 border border-gray-100">
                  <h3 className="font-bold text-sm text-[#1a1a2e] flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-[#0f3460]" /> التزام مالي جديد
                  </h3>
                  {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select value={lForm.type} onChange={(e) => setLForm({ ...lForm, type: e.target.value })} className={inputCls}>
                      <optgroup label="أنشطة تمويلية">
                        <option value="LOAN">قرض بنكي</option>
                        <option value="FINANCING_COMPANY">شركة تمويل (أمان/تسهيل)</option>
                        <option value="CHECK">شيك مستحق</option>
                      </optgroup>
                      <optgroup label="أنشطة استثمارية">
                        <option value="REAL_ESTATE">عقارات (فيلا/شقة)</option>
                        <option value="INSURANCE">تأمين على الحياة</option>
                      </optgroup>
                      <optgroup label="أخرى">
                        <option value="INSTALLMENT_PLAN">تقسيط تشغيلي</option>
                        <option value="OTHER">أخرى</option>
                      </optgroup>
                    </select>
                    <input placeholder="الجهة الدائنة" value={lForm.creditor} onChange={(e) => setLForm({ ...lForm, creditor: e.target.value })} className={inputCls} required />
                    <input type="text" inputMode="decimal" dir="ltr" min="0.01" step="0.01" placeholder="إجمالي المبلغ" value={lForm.totalAmount} onChange={(e) => setLForm({ ...lForm, totalAmount: e.target.value })} className={inputCls} required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input type="text" inputMode="decimal" dir="ltr" min="0" step="0.01" placeholder="نسبة الفائدة %" value={lForm.interestRate} onChange={(e) => setLForm({ ...lForm, interestRate: e.target.value })} className={inputCls} />
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">تاريخ البداية</label>
                      <input type="date" value={lForm.startDate} onChange={(e) => setLForm({ ...lForm, startDate: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">تاريخ السداد النهائي</label>
                      <input type="date" value={lForm.dueDate} onChange={(e) => setLForm({ ...lForm, dueDate: e.target.value })} className={inputCls} />
                    </div>
                    <input type="text" inputMode="decimal" dir="ltr" min="0" placeholder="عدد الأقساط (اختياري)" value={lForm.installmentsCount} onChange={(e) => setLForm({ ...lForm, installmentsCount: e.target.value })} className={inputCls} />
                  </div>

                  {['REAL_ESTATE', 'INSURANCE'].includes(lForm.type) && (
                    <div className="p-3 rounded-lg text-xs bg-purple-50 text-purple-700">
                      أقساط الأصول العقارية والتأمين تُصنّف كأنشطة استثمارية — لا تؤثر على قائمة الأرباح والخسائر (P&L)
                    </div>
                  )}
                  {['LOAN', 'FINANCING_COMPANY'].includes(lForm.type) && (
                    <div className="p-3 rounded-lg text-xs bg-teal-50 text-teal-700">
                      سداد القروض والتسهيلات يُصنّف كأنشطة تمويلية — يُخفّض الالتزام في الميزانية ولا يدخل P&L
                    </div>
                  )}

                  <input placeholder="ملاحظات" value={lForm.notes} onChange={(e) => setLForm({ ...lForm, notes: e.target.value })} className={inputCls} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-[#0f3460] text-white rounded-xl text-sm font-bold hover:bg-[#0a2545] disabled:opacity-50">
                      {submitting ? 'جاري الحفظ...' : 'حفظ الالتزام'}
                    </button>
                    <button type="button" onClick={() => setShowNewLiability(false)} className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm">إلغاء</button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {filteredLiabilities.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">لا يوجد التزامات مالية</div>
                )}
                {filteredLiabilities.map((l: any) => {
                  const st = STATUS_LABELS[l.status] || STATUS_LABELS.ACTIVE
                  const paidPct = Number(l.totalAmount) > 0 ? (Number(l.paidAmount) / Number(l.totalAmount)) * 100 : 0
                  const expanded = expandedLiability === l.id
                  const actType = ['REAL_ESTATE', 'INSURANCE'].includes(l.type) ? 'INVESTING' : ['LOAN', 'FINANCING_COMPANY'].includes(l.type) ? 'FINANCING' : 'OPERATING'
                  const act = ACTIVITY_LABELS[actType]
                  return (
                    <div key={l.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                      <div className="p-4 sm:p-5 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => setExpandedLiability(expanded ? null : l.id)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-[#0f3460] tabular-nums">{l.liabilityNo}</span>
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${st.bg} ${st.color}`}>{st.label}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{LIABILITY_TYPES[l.type]}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${act.bg} ${act.color}`}>{act.label}</span>
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{l.creditor}</p>
                            {l.interestRate > 0 && <p className="text-[11px] text-gray-400 mt-0.5">فائدة: {Number(l.interestRate)}%</p>}
                            {l.dueDate && (
                              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                استحقاق: {new Date(l.dueDate).toLocaleDateString('ar-EG')}
                              </p>
                            )}
                          </div>
                          <div className="text-left shrink-0">
                            <p className="text-lg font-bold tabular-nums text-[#1a1a2e]">{num(l.totalAmount)}</p>
                            <p className="text-[11px] text-gray-400">متبقي: <span className="font-bold text-red-600">{num(l.remainingAmount)}</span></p>
                          </div>
                          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
                        </div>
                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-l from-green-400 to-green-600 rounded-full transition-all" style={{ width: `${Math.min(paidPct, 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 tabular-nums">{paidPct.toFixed(0)}% مسدّد</p>
                      </div>

                      {expanded && l.installments && l.installments.length > 0 && (
                        <div className="border-t border-gray-100 px-4 sm:px-5 py-3">
                          <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> جدول الأقساط ({l.installments.length})
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400 border-b text-right">
                                  <th className="pb-2 font-medium">#</th>
                                  <th className="pb-2 font-medium">المبلغ</th>
                                  <th className="pb-2 font-medium">المدفوع</th>
                                  <th className="pb-2 font-medium">الاستحقاق</th>
                                  <th className="pb-2 font-medium">الحالة</th>
                                  <th className="pb-2 font-medium"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {l.installments.map((inst: any) => {
                                  const ist = STATUS_LABELS[inst.status] || STATUS_LABELS.UNPAID
                                  return (
                                    <tr key={inst.id} className="border-b border-gray-50 last:border-0">
                                      <td className="py-2 tabular-nums font-semibold text-gray-600">{inst.installmentNo}</td>
                                      <td className="py-2 tabular-nums font-bold">{num(inst.amount)}</td>
                                      <td className="py-2 tabular-nums text-green-600">{num(inst.paidAmount)}</td>
                                      <td className="py-2 tabular-nums text-gray-500">{new Date(inst.dueDate).toLocaleDateString('ar-EG')}</td>
                                      <td className="py-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ist.bg} ${ist.color}`}>{ist.label}</span>
                                      </td>
                                      <td className="py-2">
                                        {(inst.status === 'UNPAID' || inst.status === 'PARTIALLY_PAID' || inst.status === 'OVERDUE') && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); payInstallment(l.id, inst.id) }}
                                            className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg text-[10px] font-semibold hover:bg-green-100"
                                          >
                                            <Banknote className="w-3 h-3" /> سداد
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {expanded && (!l.installments || l.installments.length === 0) && (
                        <div className="border-t border-gray-100 px-5 py-4 text-xs text-gray-400 text-center">
                          لا يوجد أقساط مسجلة لهذا الالتزام
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ===== CASH FLOW REPORT TAB ===== */}
          {tab === 'cashflow' && cashflowReport && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">تقرير التدفقات النقدية مُصنّف حسب نوع النشاط — التشغيلي فقط يدخل قائمة الأرباح والخسائر</p>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-[11px] text-gray-500 mb-1">إجمالي الوارد</p>
                  <p className="text-xl font-bold tabular-nums text-green-700">{num(cashflowReport.summary.totalInflow)}</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-[11px] text-gray-500 mb-1">إجمالي الصادر</p>
                  <p className="text-xl font-bold tabular-nums text-red-600">{num(cashflowReport.summary.totalOutflow)}</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-[11px] text-gray-500 mb-1">صافي التدفق</p>
                  <p className={`text-xl font-bold tabular-nums ${cashflowReport.summary.netCashFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {num(cashflowReport.summary.netCashFlow)}
                  </p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-[11px] text-gray-500 mb-1">صافي التشغيل (P&L)</p>
                  <p className={`text-xl font-bold tabular-nums ${cashflowReport.summary.operatingNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {num(cashflowReport.summary.operatingNet)}
                  </p>
                </div>
              </div>

              {/* Activity Sections */}
              {(['operating', 'financing', 'investing'] as const).map((key) => {
                const section = cashflowReport[key]
                if (!section) return null
                const actKey = key.toUpperCase()
                const act = ACTIVITY_LABELS[actKey] || ACTIVITY_LABELS.OPERATING
                return (
                  <div key={key} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    <div className={`px-5 py-3 flex items-center justify-between ${act.bg}`}>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${act.color}`}>{section.label}</span>
                        {section.affectsPL ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 text-blue-700 font-semibold">يدخل P&L</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 text-gray-600 font-semibold">لا يدخل P&L</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1 text-green-700"><ArrowDownCircle className="w-3.5 h-3.5" /> وارد: {num(section.inflow)}</span>
                        <span className="flex items-center gap-1 text-red-600"><ArrowUpCircle className="w-3.5 h-3.5" /> صادر: {num(section.outflow)}</span>
                        <span className={`font-bold ${section.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>صافي: {num(section.net)}</span>
                      </div>
                    </div>
                    {section.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b text-right">
                              <th className="px-4 py-2 font-medium">الوصف</th>
                              <th className="px-4 py-2 font-medium">النوع</th>
                              <th className="px-4 py-2 font-medium">المبلغ</th>
                              <th className="px-4 py-2 font-medium">المرجع</th>
                              <th className="px-4 py-2 font-medium">التاريخ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.items.map((item: any) => (
                              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                <td className="px-4 py-2 text-gray-700 max-w-[250px] truncate">{item.description}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.type === 'IN' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {item.type === 'IN' ? 'وارد' : 'صادر'}
                                  </span>
                                </td>
                                <td className={`px-4 py-2 font-bold tabular-nums ${item.type === 'IN' ? 'text-green-700' : 'text-red-600'}`}>{num(item.amount)}</td>
                                <td className="px-4 py-2 text-gray-500 tabular-nums">{item.reference || item.voucherNo || '—'}</td>
                                <td className="px-4 py-2 text-gray-500 tabular-nums">{new Date(item.createdAt).toLocaleDateString('ar-EG')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-5 py-4 text-xs text-gray-400 text-center">لا يوجد حركات</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ===== NOTIFICATIONS TAB ===== */}
          {tab === 'notifications' && (
            <div className="space-y-4">
              {notifications.length > 0 && (
                <div className="flex justify-end">
                  <button onClick={markAllRead} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                    <BellOff className="w-3.5 h-3.5" /> تعليم الكل كمقروء
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {notifications.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                    <Bell className="w-8 h-8 text-gray-300" />
                    لا يوجد إشعارات جديدة
                  </div>
                )}
                {notifications.map((n: any) => {
                  const isOverdue = n.type.includes('OVERDUE')
                  const isPending = n.type.includes('PENDING')
                  return (
                    <div
                      key={n.id}
                      className={`bg-white rounded-xl p-4 flex items-start gap-3 border transition-colors ${
                        n.isRead ? 'border-gray-100 opacity-60' : 'border-gray-200 shadow-sm'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isOverdue ? 'bg-red-50' : isPending ? 'bg-yellow-50' : 'bg-blue-50'
                      }`}>
                        {isOverdue ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                         isPending ? <Clock className="w-4 h-4 text-yellow-600" /> :
                         <Bell className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1a1a2e]">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1 tabular-nums">{new Date(n.createdAt).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* ===== FINANCIAL SETTINGS TAB ===== */}
          {tab === 'custodies' && <CustodyPanel mode="manage" />}

          {tab === 'fin-settings' && (
            <div className="space-y-6">
              {/* بنود المصروفات */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-[#e9b44c]" /> بنود المصروفات
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">تحكّم في بنود الصرف وتصنيفها — يظهر البند عند إنشاء سند صرف جديد ويحدد نوع النشاط تلقائياً</p>
                  </div>
                  <button
                    onClick={() => { setShowNewCategory(!showNewCategory); setError(''); setEditingCategory(null) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-[#e9b44c] to-[#d9a43c] text-[#1a1a2e] rounded-xl text-sm font-bold hover:shadow-md transition-shadow"
                  >
                    <Plus className="w-4 h-4" /> بند جديد
                  </button>
                </div>

                {error && tab === 'fin-settings' && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

                {showNewCategory && (
                  <form onSubmit={submitCategory} className="bg-white rounded-2xl shadow-sm p-5 space-y-4 border border-gray-100">
                    <h4 className="font-bold text-sm text-[#1a1a2e]">إضافة بند مصروف جديد</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <input placeholder="اسم البند *" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className={inputCls} required />
                      <input placeholder="كود (اختياري)" value={catForm.code} onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })} className={inputCls} maxLength={10} />
                      <select value={catForm.activity} onChange={(e) => setCatForm({ ...catForm, activity: e.target.value, affectsPL: e.target.value === 'OPERATING' })} className={inputCls}>
                        <option value="OPERATING">تشغيلي — يدخل P&L</option>
                        <option value="INVESTING">استثماري — لا يدخل P&L</option>
                        <option value="FINANCING">تمويلي — لا يدخل P&L</option>
                      </select>
                      <select value={catForm.parentId} onChange={(e) => setCatForm({ ...catForm, parentId: e.target.value })} className={inputCls}>
                        <option value="">بند رئيسي</option>
                        {expenseCategories.filter((c: any) => !c.parentId).map((c: any) => (
                          <option key={c.id} value={c.id}>تابع لـ: {c.name}</option>
                        ))}
                      </select>
                    </div>
                    {catForm.activity === 'OPERATING' && (
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={catForm.affectsPL} onChange={(e) => setCatForm({ ...catForm, affectsPL: e.target.checked })} className="w-4 h-4 rounded border-gray-300" />
                        يدخل في قائمة الأرباح والخسائر (P&L)
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-[#0f3460] text-white rounded-xl text-sm font-bold hover:bg-[#0a2545] disabled:opacity-50">
                        {submitting ? 'جاري الحفظ...' : 'إضافة البند'}
                      </button>
                      <button type="button" onClick={() => setShowNewCategory(false)} className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm">إلغاء</button>
                    </div>
                  </form>
                )}

                {/* Categories grouped by activity */}
                {(['OPERATING', 'INVESTING', 'FINANCING'] as const).map((act) => {
                  const actLabel = ACTIVITY_LABELS[act]
                  const cats = expenseCategories.filter((c: any) => c.activity === act && !c.parentId)
                  if (cats.length === 0) return null
                  return (
                    <div key={act} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${actLabel.bg} ${actLabel.color}`}>{actLabel.label}</span>
                        <span className="text-[11px] text-gray-400">{actLabel.desc}</span>
                      </div>
                      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
                              <th className="px-4 py-2.5 font-medium w-10">#</th>
                              <th className="px-4 py-2.5 font-medium">الاسم</th>
                              <th className="px-4 py-2.5 font-medium">الكود</th>
                              <th className="px-4 py-2.5 font-medium">P&L</th>
                              <th className="px-4 py-2.5 font-medium">سندات مرتبطة</th>
                              <th className="px-4 py-2.5 font-medium">الحالة</th>
                              <th className="px-4 py-2.5 font-medium">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cats.map((c: any, i: number) => (
                              <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-2.5 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                                <td className="px-4 py-2.5">
                                  {editingCategory?.id === c.id ? (
                                    <input
                                      value={editingCategory.name}
                                      onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                      className="px-2 py-1 border rounded-lg text-sm w-full"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={`text-sm font-medium ${c.isActive ? 'text-[#1a1a2e]' : 'text-gray-400 line-through'}`}>{c.name}</span>
                                  )}
                                  {c.children?.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {c.children.map((ch: any) => (
                                        <span key={ch.id} className={`text-[10px] px-1.5 py-0.5 rounded-md ${ch.isActive ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400 line-through'}`}>{ch.name}</span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums font-mono">{c.code || '—'}</td>
                                <td className="px-4 py-2.5">
                                  {c.affectsPL ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-green-50 text-green-700 font-semibold">نعم</span>
                                  ) : (
                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-500">لا</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums">{c._count?.vouchers || 0}</td>
                                <td className="px-4 py-2.5">
                                  <button
                                    onClick={() => updateCategory(c.id, { isActive: !c.isActive })}
                                    className="flex items-center gap-1 text-xs"
                                    title={c.isActive ? 'تعطيل' : 'تفعيل'}
                                  >
                                    {c.isActive ? (
                                      <><ToggleRight className="w-5 h-5 text-green-500" /><span className="text-green-600">مفعّل</span></>
                                    ) : (
                                      <><ToggleLeft className="w-5 h-5 text-gray-400" /><span className="text-gray-400">معطّل</span></>
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1">
                                    {editingCategory?.id === c.id ? (
                                      <>
                                        <button
                                          onClick={() => updateCategory(c.id, { name: editingCategory.name })}
                                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg text-xs"
                                        >
                                          <CheckCircle2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setEditingCategory(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => setEditingCategory({ id: c.id, name: c.name })}
                                          className="p-1.5 text-gray-400 hover:text-[#0f3460] hover:bg-blue-50 rounded-lg"
                                          title="تعديل"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        {(c._count?.vouchers || 0) === 0 && (
                                          <button
                                            onClick={() => deleteCategory(c.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            title="حذف"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}

                {expenseCategories.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                    <FolderTree className="w-8 h-8 text-gray-300" />
                    لا يوجد بنود مصروفات — أضف بنود لتظهر في سندات الصرف
                  </div>
                )}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )
}
