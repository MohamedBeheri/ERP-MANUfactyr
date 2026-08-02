'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Vault, Landmark, ArrowLeftRight, Banknote, Wallet, Receipt, Printer,
  Plus, X, CheckCircle2, FileText, RefreshCw,
} from 'lucide-react'

const num = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30 text-sm bg-white'

const TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  MAIN_CASH: { label: 'الخزنة العمومية', icon: Vault, color: 'text-[#0f3460]', bg: 'bg-blue-50' },
  SALESMAN_CASH: { label: 'خزنة مندوب', icon: Wallet, color: 'text-amber-700', bg: 'bg-amber-50' },
  CLEARING_ACCOUNT: { label: 'حساب وسيط (تحت التسوية)', icon: RefreshCw, color: 'text-purple-700', bg: 'bg-purple-50' },
  BANK: { label: 'حساب بنكي', icon: Landmark, color: 'text-teal-700', bg: 'bg-teal-50' },
}

export function TreasuriesHub({ canAdd, canEdit }: { canAdd: boolean; canEdit: boolean }) {
  const [treasuries, setTreasuries] = useState<any[]>([])
  const [methods, setMethods] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [delegates, setDelegates] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [unsettled, setUnsettled] = useState<any[]>([])
  const [statement, setStatement] = useState<any>(null)
  const [showCollect, setShowCollect] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [disburseFrom, setDisburseFrom] = useState<any>(null)
  const [selectedRefs, setSelectedRefs] = useState<string[]>([])
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const safe = async (r: Response) => { try { return await r.json() } catch { return null } }
    const [tRes, mRes, cRes, dRes, colRes, unRes, catRes] = await Promise.all([
      fetch('/api/treasury/treasuries'),
      fetch('/api/treasury/payment-methods'),
      fetch('/api/customers'),
      fetch('/api/delegates'),
      fetch('/api/treasury/collections'),
      fetch('/api/treasury/collections?unsettled=1'),
      fetch('/api/treasury/expense-categories?all=1'),
    ])
    setTreasuries((await safe(tRes)) || [])
    setMethods((await safe(mRes)) || [])
    const cData = await safe(cRes); setCustomers(Array.isArray(cData) ? cData : [])
    const dData = await safe(dRes); setDelegates(Array.isArray(dData) ? dData : [])
    const colData = await safe(colRes); setCollections(Array.isArray(colData) ? colData : [])
    const unData = await safe(unRes); setUnsettled(Array.isArray(unData) ? unData : [])
    const catData = await safe(catRes); setCategories(Array.isArray(catData) ? catData : [])
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (msg: string) => { setOkMsg(msg); setTimeout(() => setOkMsg(''), 4000) }

  async function openStatement(id: string) {
    const res = await fetch(`/api/treasury/treasuries/${id}`)
    if (res.ok) setStatement(await res.json())
  }

  async function toggleExpense(t: any) {
    await fetch(`/api/treasury/treasuries/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowExpenseDisbursement: !t.allowExpenseDisbursement }),
    })
    load()
  }

  const banks = treasuries.filter((t) => t.type === 'BANK')
  const unsettledTotal = unsettled.reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex justify-between"><span>{error}</span><button onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}
      {okMsg && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{okMsg}</div>}

      {/* بطاقات الخزائن */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {treasuries.map((t) => {
          const meta = TYPE_META[t.type] || TYPE_META.MAIN_CASH
          const Icon = meta.icon
          return (
            <div key={t.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
              </div>
              <p className="font-bold text-sm text-[#1a1a2e] truncate">{t.name}</p>
              <p className="text-xl font-black tabular-nums text-[#1a1a2e]">{num(t.balance)} <span className="text-xs font-normal text-gray-400">ج.م</span></p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button onClick={() => openStatement(t.id)} className="text-[11px] font-semibold text-[#0f3460] hover:underline flex items-center gap-1">
                  <FileText className="w-3 h-3" /> كشف حساب
                </button>
                {t.allowExpenseDisbursement && canAdd && (
                  <button onClick={() => setDisburseFrom(t)} className="text-[11px] font-semibold text-red-600 hover:underline flex items-center gap-1">
                    <Receipt className="w-3 h-3" /> صرف مصروف
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => toggleExpense(t)} className="text-[11px] text-gray-400 hover:text-gray-600 mr-auto" title="تفعيل/إيقاف الصرف من الخزنة">
                    {t.allowExpenseDisbursement ? 'الصرف مفعّل ✓' : 'الصرف موقوف'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* أزرار العمليات */}
      <div className="flex flex-wrap gap-2">
        {canAdd && (
          <button onClick={() => { setShowCollect(!showCollect); setShowTransfer(false) }} className="bg-[#0f3460] text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> سند تحصيل جديد
          </button>
        )}
        {canAdd && (
          <button onClick={() => { setShowTransfer(!showTransfer); setShowCollect(false) }} className="bg-white border border-gray-200 text-[#1a1a2e] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" /> تحويل بين الخزائن (تصفية)
          </button>
        )}
      </div>

      {showCollect && <CollectForm customers={customers} delegates={delegates} methods={methods} onDone={() => { setShowCollect(false); load(); flash('تم تسجيل سند التحصيل ✓') }} onError={setError} />}
      {showTransfer && <TransferForm treasuries={treasuries} onDone={() => { setShowTransfer(false); load(); flash('تم التحويل بنجاح ✓') }} onError={setError} />}
      {disburseFrom && <DisburseForm treasury={disburseFrom} categories={categories} onClose={() => setDisburseFrom(null)} onDone={() => { setDisburseFrom(null); load(); flash('تم صرف المصروف وخصمه من الخزنة ✓') }} onError={setError} />}

      {/* تسوية إنستا باي */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-[#1a1a2e]">تحويلات إنستا باي تحت التسوية ({unsettled.length})</h3>
            <p className="text-xs text-gray-400">التحويلات اللي لسه ما اتطابقتش مع البنك — إجمالي {num(unsettledTotal)} ج.م</p>
          </div>
          {canEdit && unsettled.length > 0 && (
            <SettleControls
              banks={banks}
              selected={selectedRefs}
              onSettled={() => { setSelectedRefs([]); load(); flash('تمت مطابقة التحويلات مع البنك ✓') }}
              onError={setError}
              busy={busy}
              setBusy={setBusy}
            />
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50">
                {canEdit && <th className="p-3 w-10"></th>}
                <th className="p-3 font-medium">رقم السند</th>
                <th className="p-3 font-medium">الرقم المرجعي</th>
                <th className="p-3 font-medium">العميل</th>
                <th className="p-3 font-medium">المبلغ</th>
                <th className="p-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {unsettled.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش تحويلات معلقة — كله متسوّي مع البنك ✓</td></tr>
              )}
              {unsettled.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  {canEdit && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedRefs.includes(c.id)}
                        onChange={(e) => setSelectedRefs(e.target.checked ? [...selectedRefs, c.id] : selectedRefs.filter((x) => x !== c.id))}
                      />
                    </td>
                  )}
                  <td className="p-3 font-semibold tabular-nums">{c.collectionNo}</td>
                  <td className="p-3 font-mono text-xs text-purple-700">{c.transactionReference}</td>
                  <td className="p-3">{c.customer?.name}</td>
                  <td className="p-3 font-bold tabular-nums">{num(c.amount)} ج.م</td>
                  <td className="p-3 text-gray-400 text-xs tabular-nums">{new Date(c.createdAt).toLocaleDateString('ar-EG')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* آخر سندات التحصيل */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-[#1a1a2e]">آخر سندات التحصيل</h3>
          <p className="text-xs text-gray-400">الإلكتروني بيدخل الحساب الوسيط تلقائي — النقدي بيدخل خزنة المندوب أو العمومية</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">رقم السند</th>
                <th className="p-3 font-medium">العميل</th>
                <th className="p-3 font-medium">الوسيلة</th>
                <th className="p-3 font-medium">الخزنة</th>
                <th className="p-3 font-medium">المبلغ</th>
                <th className="p-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {collections.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">مفيش سندات تحصيل لسه.</td></tr>
              )}
              {collections.slice(0, 20).map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold tabular-nums">{c.collectionNo}</td>
                  <td className="p-3">{c.customer?.name}{c.delegate ? <span className="text-xs text-gray-400"> · {c.delegate.name}</span> : null}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${c.paymentMethod?.type === 'ELECTRONIC' ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'}`}>
                      {c.paymentMethod?.name}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-500">{c.treasury?.name}</td>
                  <td className="p-3 font-bold tabular-nums">{num(c.amount)} ج.م</td>
                  <td className="p-3">
                    {c.paymentMethod?.type === 'ELECTRONIC' ? (
                      c.isSettled
                        ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-semibold">متسوّي بنكيًا</span>
                        : <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded font-semibold">تحت التسوية</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال كشف الحساب */}
      {statement && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setStatement(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-[#1a1a2e]">كشف حساب — {statement.treasury.name}</h3>
                <p className="text-xs text-gray-400">الرصيد الحالي: <span className="font-bold text-[#1a1a2e] tabular-nums">{num(statement.treasury.balance)} ج.م</span></p>
              </div>
              <button onClick={() => setStatement(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-gray-500 text-right border-b border-gray-100">
                    <th className="p-3 font-medium">البيان</th>
                    <th className="p-3 font-medium">وارد</th>
                    <th className="p-3 font-medium">منصرف</th>
                    <th className="p-3 font-medium">الرصيد</th>
                    <th className="p-3 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.transactions.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-500">مفيش حركات على الخزنة دي.</td></tr>
                  )}
                  {statement.transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-gray-50 last:border-0">
                      <td className="p-3">
                        <p className="font-medium text-[#1a1a2e]">{tx.description}</p>
                        {tx.reference && <p className="text-[10px] text-gray-400 font-mono">{tx.reference}</p>}
                      </td>
                      <td className="p-3 tabular-nums text-green-600 font-semibold">{tx.type === 'IN' ? `+${num(tx.amount)}` : ''}</td>
                      <td className="p-3 tabular-nums text-red-600 font-semibold">{tx.type === 'OUT' ? `-${num(tx.amount)}` : ''}</td>
                      <td className="p-3 tabular-nums font-bold">{num(tx.balance)}</td>
                      <td className="p-3 text-xs text-gray-400 tabular-nums">{new Date(tx.createdAt).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CollectForm({ customers, delegates, methods, onDone, onError }: any) {
  const [customerId, setCustomerId] = useState('')
  const [delegateId, setDelegateId] = useState('')
  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const method = methods.find((m: any) => m.id === methodId)
  const isElectronic = method?.type === 'ELECTRONIC'

  async function submit() {
    setBusy(true)
    onError('')
    const res = await fetch('/api/treasury/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, delegateId: delegateId || null, paymentMethodId: methodId, amount: Number(amount), transactionReference: ref, notes }),
    })
    setBusy(false)
    if (!res.ok) return onError((await res.json()).error || 'فشل الحفظ')
    onDone()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2"><Banknote className="w-4 h-4 text-[#0f3460]" /> سند تحصيل من عميل</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">اختار العميل *</option>
          {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}{Number(c.balance) > 0 ? ` — مديونية ${num(c.balance)} ج.م` : ''}</option>)}
        </select>
        <select className={inputCls} value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
          <option value="">بدون مندوب (تحصيل مباشر)</option>
          {delegates.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className={inputCls} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
          <option value="">وسيلة الدفع *</option>
          {methods.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input className={inputCls} type="number" placeholder="المبلغ *" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {isElectronic && (
          <input className={inputCls} placeholder="الرقم المرجعي للعملية (إجباري) *" value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" />
        )}
        <input className={inputCls} placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {isElectronic && (
        <p className="text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-2">
          تحصيل إنستا باي بيتوجّه تلقائي لحساب "إنستا باي تحت التسوية" — مش لخزنة المندوب النقدية، وبالتالي مش هيظهر في جرده النقدي.
        </p>
      )}
      <button onClick={submit} disabled={busy || !customerId || !methodId || !amount} className="bg-[#0f3460] text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40">
        {busy ? 'جارٍ الحفظ...' : 'حفظ سند التحصيل'}
      </button>
    </div>
  )
}

function TransferForm({ treasuries, onDone, onError }: any) {
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    onError('')
    const res = await fetch('/api/treasury/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceTreasuryId: sourceId, targetTreasuryId: targetId, amount: Number(amount), notes }),
    })
    setBusy(false)
    if (!res.ok) return onError((await res.json()).error || 'فشل التحويل')
    onDone()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-[#0f3460]" /> تحويل بين الخزائن — تصفية كاش المندوب للخزنة العمومية</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <select className={inputCls} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">من خزنة *</option>
          {treasuries.map((t: any) => <option key={t.id} value={t.id}>{t.name} — {num(t.balance)} ج.م</option>)}
        </select>
        <select className={inputCls} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">إلى خزنة *</option>
          {treasuries.filter((t: any) => t.id !== sourceId).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className={inputCls} type="number" placeholder="المبلغ *" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className={inputCls} placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button onClick={submit} disabled={busy || !sourceId || !targetId || !amount} className="bg-[#0f3460] text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40">
        {busy ? 'جارٍ التحويل...' : 'تنفيذ التحويل'}
      </button>
    </div>
  )
}

function DisburseForm({ treasury, categories, onClose, onDone, onError }: any) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [printedId, setPrintedId] = useState('')

  async function submit() {
    setBusy(true)
    onError('')
    const res = await fetch('/api/treasury/payment-vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount: Number(amount), categoryId: categoryId || null, treasuryId: treasury.id, notes }),
    })
    setBusy(false)
    if (!res.ok) return onError((await res.json()).error || 'فشل الصرف')
    const v = await res.json()
    setPrintedId(v.id)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#1a1a2e] flex items-center gap-2"><Receipt className="w-4 h-4 text-red-600" /> صرف مصروف من {treasury.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500">الرصيد المتاح: <span className="font-bold tabular-nums">{num(treasury.balance)} ج.م</span> — المبلغ هيتخصم فورًا</p>
        {printedId ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
            <p className="text-sm font-bold text-green-700">تم صرف المصروف وخصمه من الخزنة</p>
            <div className="flex gap-2 justify-center">
              <a href={`/print/voucher/${printedId}`} target="_blank" className="bg-[#0f3460] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                <Printer className="w-4 h-4" /> طباعة سند الصرف
              </a>
              <button onClick={onDone} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold">إغلاق</button>
            </div>
          </div>
        ) : (
          <>
            <input className={inputCls} placeholder="وصف المصروف *" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className={inputCls} type="number" placeholder="المبلغ *" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">بند المصروف (شجرة الحسابات)</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className={inputCls} placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button onClick={submit} disabled={busy || !description || !amount} className="w-full bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-40">
              {busy ? 'جارٍ الصرف...' : 'صرف وخصم من الخزنة'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function SettleControls({ banks, selected, onSettled, onError, busy, setBusy }: any) {
  const [bankId, setBankId] = useState(banks[0]?.id || '')

  useEffect(() => { if (!bankId && banks[0]) setBankId(banks[0].id) }, [banks, bankId])

  async function settle() {
    if (selected.length === 0) return onError('اختار تحويل واحد على الأقل للمطابقة')
    setBusy(true)
    onError('')
    const res = await fetch('/api/treasury/instapay-settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionIds: selected, targetBankTreasuryId: bankId }),
    })
    setBusy(false)
    if (!res.ok) return onError((await res.json()).error || 'فشل التسوية')
    onSettled()
  }

  return (
    <div className="flex items-center gap-2">
      <select className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white" value={bankId} onChange={(e) => setBankId(e.target.value)}>
        {banks.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <button onClick={settle} disabled={busy || selected.length === 0} className="bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> مطابقة المحدد ({selected.length}) مع البنك
      </button>
    </div>
  )
}
