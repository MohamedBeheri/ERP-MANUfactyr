'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/use-permissions'
import {
  HandCoins, Plus, X, CheckCircle2, XCircle, Banknote, Receipt,
  Paperclip, ChevronDown, ChevronUp, Undo2, Wallet,
} from 'lucide-react'

interface Lite { id: string; name: string }
interface ExpenseRow {
  id: string
  amount: number
  description: string
  attachment: string | null
  status: string
  category: { name: string } | null
  creator: { name: string }
  approvedBy: { name: string } | null
  createdAt: string
}
interface CustodyRow {
  id: string
  custodyNo: string
  purpose: string
  requestedAmount: number
  approvedAmount: number | null
  returnedAmount: number | null
  status: string
  rejectReason: string | null
  notes: string | null
  createdAt: string
  approvedAt: string | null
  disbursedAt: string | null
  settledAt: string | null
  user: { id: string; name: string; jobTitle: string | null }
  creator: { name: string }
  approvedBy: { name: string } | null
  disbursedBy: { name: string } | null
  settledBy: { name: string } | null
  paymentMethod: { name: string } | null
  returnMethod: { name: string } | null
  treasury: { name: string } | null
  returnTreasury: { name: string } | null
  expenses: ExpenseRow[]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'بانتظار الاعتماد', cls: 'bg-yellow-50 text-yellow-700' },
  APPROVED: { label: 'معتمدة — بانتظار الصرف', cls: 'bg-blue-50 text-blue-700' },
  REJECTED: { label: 'مرفوضة', cls: 'bg-red-50 text-red-600' },
  DISBURSED: { label: 'مصروفة — عهدة مفتوحة', cls: 'bg-orange-50 text-orange-700' },
  SETTLED: { label: 'متسوّية', cls: 'bg-green-50 text-green-700' },
}
const EXP_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'بانتظار الاعتماد', cls: 'bg-yellow-50 text-yellow-700' },
  APPROVED: { label: 'معتمد', cls: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'مرفوض', cls: 'bg-red-50 text-red-600' },
}

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const dateOf = (s: string) => new Date(s).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeOf = (s: string) => new Date(s).toLocaleString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30 text-sm bg-white'

// ضغط صورة الإثبات قبل الرفع (نفس نمط مرفقات سندات الصرف)
function fileToDataUrl(file: File, maxSize = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('صورة غير صالحة')) }
    img.src = url
  })
}

// لوحة عُهد الموظفين — إدارة كاملة (mode=manage) أو عرض شخصي للموظف (mode=mine)
export function CustodyPanel({ mode }: { mode: 'manage' | 'mine' }) {
  const { data: session } = useSession()
  const { can } = usePermissions()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canTreasury = can('treasury', 'edit')

  const [custodies, setCustodies] = useState<CustodyRow[]>([])
  const [methods, setMethods] = useState<Lite[]>([])
  const [treasuries, setTreasuries] = useState<(Lite & { allowExpenseDisbursement: boolean })[]>([])
  const [categories, setCategories] = useState<Lite[]>([])
  const [employees, setEmployees] = useState<Lite[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [openId, setOpenId] = useState('')

  const [reqOpen, setReqOpen] = useState(false)
  const [reqForm, setReqForm] = useState({ userId: '', amount: '', purpose: '', notes: '' })

  const load = useCallback(async () => {
    const res = await fetch(`/api/custodies${mode === 'mine' ? '?mine=1' : ''}`)
    if (res.ok) setCustodies(await res.json())
    // القوائم المساعدة — بتفشل بصمت لو المستخدم ملوش صلاحية خزنة (وضع mine)
    fetch('/api/treasury/payment-methods').then(async (r) => r.ok && setMethods((await r.json()).filter((m: any) => m.isActive)))
    fetch('/api/treasury/treasuries').then(async (r) => r.ok && setTreasuries((await r.json()).filter((t: any) => t.isActive)))
    fetch('/api/treasury/expense-categories').then(async (r) => r.ok && setCategories(await r.json()))
    if (mode === 'manage') {
      fetch('/api/users').then(async (r) => r.ok && setEmployees((await r.json()).filter((u: any) => u.status === 'ACTIVE')))
    }
  }, [mode])
  useEffect(() => { load() }, [load])

  const act = async (url: string, body: any, key: string) => {
    setBusy(key); setError('')
    const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setBusy('')
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return false }
    await load()
    return true
  }

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy('req'); setError('')
    const res = await fetch('/api/custodies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqForm),
    })
    setBusy('')
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setReqForm({ userId: '', amount: '', purpose: '', notes: '' }); setReqOpen(false)
    await load()
  }

  const openCustodies = custodies.filter((c) => c.status === 'DISBURSED')
  const inCustodyTotal = openCustodies.reduce((s, c) => {
    const approved = c.expenses.filter((e) => e.status === 'APPROVED').reduce((x, e) => x + Number(e.amount), 0)
    return s + Number(c.approvedAmount) - approved
  }, 0)

  return (
    <div className="space-y-4">
      {mode === 'manage' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'طلبات بانتظار الاعتماد', value: custodies.filter((c) => c.status === 'PENDING').length, cls: 'text-yellow-700' },
            { label: 'معتمدة بانتظار الصرف', value: custodies.filter((c) => c.status === 'APPROVED').length, cls: 'text-blue-700' },
            { label: 'عُهد مفتوحة', value: openCustodies.length, cls: 'text-orange-700' },
            { label: 'نقدية في عُهد (خارج الخزنة)', value: `${money(inCustodyTotal)} ج.م`, cls: 'text-[#0f3460]' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-[11px] text-gray-500">{k.label}</p>
              <p className={`text-lg font-bold tabular-nums mt-1 ${k.cls}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      {/* طلب عهدة جديد */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-[#0f3460]" />
            {mode === 'mine' ? 'عُهدي' : `عُهد الموظفين (${custodies.length})`}
          </h3>
          {!reqOpen && (
            <button onClick={() => setReqOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2545]">
              <Plus className="w-4 h-4" /> {mode === 'manage' ? 'صرف عهدة' : 'طلب عهدة'}
            </button>
          )}
        </div>
        {reqOpen && (
          <form onSubmit={submitRequest} className="mx-4 mb-4 border border-gray-200 rounded-xl p-4 bg-gray-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm">{mode === 'manage' ? 'صرف عهدة لموظف' : 'طلب عهدة جديد'}</h4>
              <button type="button" onClick={() => setReqOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {mode === 'manage' && (
                <select value={reqForm.userId} onChange={(e) => setReqForm({ ...reqForm, userId: e.target.value })} className={inputCls} required>
                  <option value="">اختار الموظف *</option>
                  {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
              <input type="text" inputMode="decimal" dir="ltr" value={reqForm.amount} onChange={(e) => setReqForm({ ...reqForm, amount: e.target.value })} className={inputCls} placeholder="المبلغ المطلوب *" required />
              <input value={reqForm.purpose} onChange={(e) => setReqForm({ ...reqForm, purpose: e.target.value })} className={inputCls} placeholder="العهدة دي خاصة بإيه؟ (الغرض) *" required />
              <input value={reqForm.notes} onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })} className={inputCls} placeholder="ملاحظات (اختياري)" />
            </div>
            <button type="submit" disabled={busy === 'req'} className="px-6 bg-[#0f3460] text-white py-2 rounded-lg font-semibold text-sm disabled:opacity-50">
              {busy === 'req' ? 'جاري...' : 'إرسال الطلب'}
            </button>
          </form>
        )}

        <div className="divide-y divide-gray-50">
          {custodies.length === 0 && <p className="p-6 text-center text-gray-500 text-sm">مفيش عُهد لسه.</p>}
          {custodies.map((c) => (
            <CustodyCard
              key={c.id}
              c={c}
              open={openId === c.id}
              onToggle={() => setOpenId(openId === c.id ? '' : c.id)}
              isAdmin={isAdmin}
              canTreasury={canTreasury}
              isOwner={c.user.id === session?.user?.id}
              methods={methods}
              treasuries={treasuries}
              categories={categories}
              busy={busy}
              act={act}
              onReload={load}
              setError={setError}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CustodyCard({ c, open, onToggle, isAdmin, canTreasury, isOwner, methods, treasuries, categories, busy, act, onReload, setError }: {
  c: CustodyRow
  open: boolean
  onToggle: () => void
  isAdmin: boolean
  canTreasury: boolean
  isOwner: boolean
  methods: Lite[]
  treasuries: (Lite & { allowExpenseDisbursement: boolean })[]
  categories: Lite[]
  busy: string
  act: (url: string, body: any, key: string) => Promise<boolean>
  onReload: () => Promise<void>
  setError: (s: string) => void
}) {
  const st = STATUS[c.status] || STATUS.PENDING
  const amount = Number(c.approvedAmount ?? c.requestedAmount)
  const approvedExpenses = c.expenses.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + Number(e.amount), 0)
  const remaining = +(Number(c.approvedAmount || 0) - approvedExpenses).toFixed(2)

  const [approveAmount, setApproveAmount] = useState('')
  const [disb, setDisb] = useState({ paymentMethodId: '', treasuryId: '' })
  const [ret, setRet] = useState({ returnMethodId: '', returnTreasuryId: '' })
  const [expForm, setExpForm] = useState({ amount: '', categoryId: '', description: '', attachment: '' })
  const [expBusy, setExpBusy] = useState(false)

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setExpBusy(true); setError('')
    const res = await fetch(`/api/custodies/${c.id}/expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expForm),
    })
    setExpBusy(false)
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'حصل خطأ'); return }
    setExpForm({ amount: '', categoryId: '', description: '', attachment: '' })
    await onReload()
  }

  return (
    <div>
      <button onClick={onToggle} className="w-full text-right p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
        <div className="min-w-0">
          <p className="font-bold text-sm text-[#1a1a2e] tabular-nums">
            {c.custodyNo}
            <span className="font-normal text-gray-500"> — {c.user.name}{c.user.jobTitle ? ` (${c.user.jobTitle})` : ''}</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{c.purpose} · {dateOf(c.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-sm tabular-nums text-[#0f3460]">{money(amount)} ج.م</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* تفاصيل الطلب */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs bg-gray-50 rounded-lg p-3">
            <div className="col-span-full"><span className="text-gray-400">الغرض من العهدة:</span> <span className="font-semibold">{c.purpose}</span>{c.notes && <span className="text-gray-500"> — {c.notes}</span>}</div>
            <div><span className="text-gray-400">المبلغ المطلوب:</span> <span className="font-semibold tabular-nums">{money(Number(c.requestedAmount))} ج.م</span></div>
            {c.approvedAmount != null && <div><span className="text-gray-400">المبلغ المعتمد:</span> <span className="font-semibold tabular-nums text-green-700">{money(Number(c.approvedAmount))} ج.م</span></div>}
            {c.returnedAmount != null && <div><span className="text-gray-400">المرتجع للخزنة:</span> <span className="font-semibold tabular-nums text-[#0f3460]">{money(Number(c.returnedAmount))} ج.م{c.returnTreasury ? ` (${c.returnTreasury.name})` : ''}</span></div>}
          </div>

          {/* تاريخ الاعتمادات — كل خطوة بمين وامتى */}
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 text-xs">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span><span className="text-gray-400">الطلب بواسطة:</span> <span className="font-semibold">{c.creator.name}</span></span>
              <span className="text-gray-400 tabular-nums shrink-0">{dateTimeOf(c.createdAt)}</span>
            </div>
            {c.approvedBy && (
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span><span className="text-gray-400">{c.status === 'REJECTED' ? 'الرفض بواسطة:' : 'الاعتماد بواسطة:'}</span> <span className="font-semibold">{c.approvedBy.name}</span></span>
                {c.approvedAt && <span className="text-gray-400 tabular-nums shrink-0">{dateTimeOf(c.approvedAt)}</span>}
              </div>
            )}
            {c.disbursedBy && (
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span><span className="text-gray-400">الصرف بواسطة:</span> <span className="font-semibold">{c.disbursedBy.name}</span> <span className="text-gray-500">· {c.paymentMethod?.name} من {c.treasury?.name}</span></span>
                {c.disbursedAt && <span className="text-gray-400 tabular-nums shrink-0">{dateTimeOf(c.disbursedAt)}</span>}
              </div>
            )}
            {c.settledBy && (
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span><span className="text-gray-400">التسوية بواسطة:</span> <span className="font-semibold">{c.settledBy.name}</span>{c.returnMethod && <span className="text-gray-500"> · مرتجع {c.returnMethod.name}</span>}</span>
                {c.settledAt && <span className="text-gray-400 tabular-nums shrink-0">{dateTimeOf(c.settledAt)}</span>}
              </div>
            )}
            {c.rejectReason && <div className="px-3 py-2 text-red-600">سبب الرفض: {c.rejectReason}</div>}
          </div>

          {/* اعتماد/رفض — أدمن */}
          {c.status === 'PENDING' && isAdmin && (
            <div className="flex flex-wrap items-center gap-2 border border-yellow-200 bg-yellow-50/40 rounded-lg p-3">
              <input type="text" inputMode="decimal" dir="ltr" value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)}
                placeholder={`مبلغ الاعتماد (افتراضي ${money(Number(c.requestedAmount))})`} className="flex-1 min-w-[180px] px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums" />
              <button onClick={() => act(`/api/custodies/${c.id}`, { action: 'approve', approvedAmount: approveAmount || undefined }, c.id + 'ap')}
                disabled={busy === c.id + 'ap'} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> اعتماد
              </button>
              <button onClick={() => { const r = prompt('سبب الرفض؟'); if (r) act(`/api/custodies/${c.id}`, { action: 'reject', reason: r }, c.id + 'rj') }}
                disabled={busy === c.id + 'rj'} className="text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                <XCircle className="w-4 h-4" /> رفض
              </button>
            </div>
          )}

          {/* الصرف — خزنة */}
          {c.status === 'APPROVED' && canTreasury && (
            <div className="flex flex-wrap items-center gap-2 border border-blue-200 bg-blue-50/40 rounded-lg p-3">
              <Banknote className="w-4 h-4 text-blue-600 shrink-0" />
              <select value={disb.paymentMethodId} onChange={(e) => setDisb({ ...disb, paymentMethodId: e.target.value })} className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">وسيلة الصرف *</option>
                {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={disb.treasuryId} onChange={(e) => setDisb({ ...disb, treasuryId: e.target.value })} className="flex-1 min-w-[160px] px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">تخصم من خزنة *</option>
                {treasuries.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={() => act(`/api/custodies/${c.id}`, { action: 'disburse', ...disb }, c.id + 'db')}
                disabled={busy === c.id + 'db' || !disb.paymentMethodId || !disb.treasuryId}
                className="bg-[#0f3460] text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                {busy === c.id + 'db' ? 'جاري...' : `صرف ${money(amount)} ج.م`}
              </button>
            </div>
          )}

          {/* المصروفات — عهدة مفتوحة أو متسوّية */}
          {(c.status === 'DISBURSED' || c.status === 'SETTLED') && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50/70 px-3 py-2">
                <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> مصروفات العهدة ({c.expenses.length})</p>
                <p className="text-xs tabular-nums text-gray-500">معتمد: <b className="text-green-700">{money(approvedExpenses)}</b> · متبقي في العهدة: <b className="text-orange-700">{money(remaining)}</b> ج.م</p>
              </div>
              <div className="divide-y divide-gray-50">
                {c.expenses.length === 0 && <p className="p-3 text-xs text-gray-400 text-center">مفيش مصروفات متسجلة.</p>}
                {c.expenses.map((e) => {
                  const es = EXP_STATUS[e.status] || EXP_STATUS.PENDING
                  return (
                    <div key={e.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{e.description}{e.category ? <span className="text-xs text-gray-400 font-normal"> · {e.category.name}</span> : null}</p>
                        <p className="text-[11px] text-gray-400">{e.creator.name} · {dateOf(e.createdAt)}{e.approvedBy ? ` · اعتمده ${e.approvedBy.name}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {e.attachment && (
                          <a href={e.attachment} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-[#0f3460]" title="عرض الإثبات">
                            <Paperclip className="w-4 h-4" />
                          </a>
                        )}
                        <span className="font-bold text-sm tabular-nums">{money(Number(e.amount))} ج.م</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${es.cls}`}>{es.label}</span>
                        {e.status === 'PENDING' && canTreasury && (
                          <>
                            <button onClick={() => act(`/api/custodies/${c.id}/expenses`, { expenseId: e.id, action: 'approve' }, e.id + 'a')} className="text-green-600 p-1" title="اعتماد"><CheckCircle2 className="w-4 h-4" /></button>
                            <button onClick={() => act(`/api/custodies/${c.id}/expenses`, { expenseId: e.id, action: 'reject' }, e.id + 'r')} className="text-red-500 p-1" title="رفض"><XCircle className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* تسجيل مصروف — صاحب العهدة أو الخزنة، والعهدة لسه مفتوحة */}
              {c.status === 'DISBURSED' && (isOwner || canTreasury) && (
                <form onSubmit={submitExpense} className="border-t border-gray-100 p-3 grid grid-cols-1 md:grid-cols-5 gap-2 bg-gray-50/40">
                  <input type="text" inputMode="decimal" dir="ltr" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className={inputCls} placeholder="المبلغ *" required />
                  <select value={expForm.categoryId} onChange={(e) => setExpForm({ ...expForm, categoryId: e.target.value })} className={inputCls}>
                    <option value="">بند المصروف</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <input value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className={inputCls} placeholder="وصف المصروف *" required />
                  <label className={`${inputCls} flex items-center gap-1.5 cursor-pointer ${expForm.attachment ? 'text-green-700' : 'text-gray-400'}`}>
                    <Paperclip className="w-4 h-4 shrink-0" />
                    <span className="truncate text-xs">{expForm.attachment ? 'الإثبات مرفق ✓' : 'صورة الإيصال (إجباري) *'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (f) try { setExpForm({ ...expForm, attachment: await fileToDataUrl(f) }) } catch { /* صورة غير صالحة */ }
                    }} />
                  </label>
                  <button type="submit" disabled={expBusy || !expForm.attachment} className="bg-[#0f3460] text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                    {expBusy ? 'جاري...' : 'تسجيل المصروف'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* التسوية — خزنة */}
          {c.status === 'DISBURSED' && canTreasury && (
            <div className="flex flex-wrap items-center gap-2 border border-green-200 bg-green-50/40 rounded-lg p-3">
              <Undo2 className="w-4 h-4 text-green-700 shrink-0" />
              <p className="text-xs text-gray-600">
                التسوية: مصروفات معتمدة <b className="tabular-nums">{money(approvedExpenses)}</b> ج.م — الموظف يرجّع <b className="tabular-nums text-green-700">{money(remaining)}</b> ج.م
              </p>
              {remaining > 0 && (
                <>
                  <select value={ret.returnMethodId} onChange={(e) => setRet({ ...ret, returnMethodId: e.target.value })} className="flex-1 min-w-[130px] px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">وسيلة الاسترداد *</option>
                    {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <select value={ret.returnTreasuryId} onChange={(e) => setRet({ ...ret, returnTreasuryId: e.target.value })} className="flex-1 min-w-[150px] px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">ترجع لخزنة *</option>
                    {treasuries.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </>
              )}
              <button onClick={() => act(`/api/custodies/${c.id}`, { action: 'settle', ...ret }, c.id + 'st')}
                disabled={busy === c.id + 'st' || (remaining > 0 && (!ret.returnMethodId || !ret.returnTreasuryId))}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                {busy === c.id + 'st' ? 'جاري...' : 'تسوية العهدة'}
              </button>
            </div>
          )}

          {/* ملخص التسوية */}
          {c.status === 'SETTLED' && (
            <div className="flex flex-wrap items-center gap-3 text-xs bg-green-50 border border-green-100 rounded-lg p-3 text-green-800">
              <Wallet className="w-4 h-4" />
              <span>مصروفات معتمدة: <b className="tabular-nums">{money(approvedExpenses)}</b> ج.م</span>
              <span>مرتجع للخزنة: <b className="tabular-nums">{money(Number(c.returnedAmount || 0))}</b> ج.م{c.returnTreasury ? ` (${c.returnMethod?.name} → ${c.returnTreasury.name})` : ''}</span>
              {c.settledAt && <span className="text-green-600/70">{dateOf(c.settledAt)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
