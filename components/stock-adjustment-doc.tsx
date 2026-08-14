'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ClipboardCheck, CheckCircle2, Undo2, Lock, Printer, AlertTriangle, ShieldCheck } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const fmt = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 3 })

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'مسودة', cls: 'bg-gray-100 text-gray-600' },
  IN_PROGRESS: { label: 'جاري العد', cls: 'bg-amber-50 text-amber-700' },
  REVIEWING: { label: 'مراجعة الفروق', cls: 'bg-blue-50 text-blue-700' },
  POSTED: { label: 'معتمد ومرحّل', cls: 'bg-green-50 text-green-700' },
  CLOSED: { label: 'مغلق', cls: 'bg-gray-200 text-gray-700' },
  REVERSED: { label: 'اتلغى اعتماده', cls: 'bg-red-50 text-red-600' },
}
const ACTION: Record<string, { label: string; cls: string }> = {
  SHORTAGE: { label: 'عجز', cls: 'text-red-600' },
  SURPLUS: { label: 'زيادة', cls: 'text-green-700' },
  MATCHED: { label: 'مطابق', cls: 'text-gray-400' },
}

interface Item { id: string; productName: string; unit: string; lotTracked: boolean; snapshotQty: number; liveQty: number; countedQty: number | null; varianceQty: number; unitCost: number; varianceCost: number; action: string; batchNo: string | null; expiryDate: string | null; binLocation: string | null; accountId: string | null }
interface Adj {
  id: string; docNo: string; status: string; adjustmentType: string; reasonCode: string | null; stocktakeRef: string | null
  warehouseName: string; createdByName: string; approvedByName: string | null; postingDate: string | null
  shortageCost: number; surplusCost: number; totalVarianceCost: number
  journal: { entryNo: string; lines: { account: string; debit: number; credit: number }[] } | null
  items: Item[]
  isAdmin: boolean
}
interface GLAccount { id: string; code: string; name: string }

export function StockAdjustmentDoc({ adj, glAccounts = [] }: { adj: Adj; glAccounts?: GLAccount[] }) {
  const router = useRouter()
  const editable = adj.status === 'IN_PROGRESS' || adj.status === 'REVIEWING'
  // الجرد الأعمى: أمين المخزن (غير الأدمن) بيعدّ من غير ما يشوف الرصيد الدفتري ولا الفروق ولا التكلفة
  const blind = !adj.isAdmin
  const [counts, setCounts] = useState<Record<string, string>>(
    Object.fromEntries(adj.items.map((i) => [i.id, i.countedQty != null ? String(i.countedQty) : '']))
  )
  const [lots, setLots] = useState<Record<string, { batchNo: string; expiryDate: string; binLocation: string }>>(
    Object.fromEntries(adj.items.map((i) => [i.id, { batchNo: i.batchNo || '', expiryDate: i.expiryDate || '', binLocation: i.binLocation || '' }]))
  )
  const setLot = (id: string, k: 'batchNo' | 'expiryDate' | 'binLocation', v: string) => setLots((p) => ({ ...p, [id]: { ...p[id], [k]: v } }))
  const [accounts, setAccounts] = useState<Record<string, string>>(
    Object.fromEntries(adj.items.map((i) => [i.id, i.accountId || '']))
  )
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const list = search.trim() ? adj.items.filter((i) => i.productName.includes(search.trim())) : adj.items
  // حركات مخزنية حصلت بعد لقطة الجرد (تزامن) — الرصيد الدفتري اللحظي مختلف عن اللقطة
  const moved = adj.items.filter((i) => Math.abs(i.liveQty - i.snapshotQty) > 0.0009)

  // حساب لايف من المدخلات
  const liveVar = (it: Item) => { const c = counts[it.id]; if (c === '' || c == null) return null; return +(Number(c) - it.snapshotQty).toFixed(3) }
  let short = 0, surplus = 0
  for (const it of adj.items) { const v = liveVar(it); if (v == null) continue; const cost = Math.abs(v) * it.unitCost; if (v < 0) short += cost; else if (v > 0) surplus += cost }

  const saveCounts = async () => {
    setBusy('save'); setError('')
    const payload = adj.items
      .map((i) => ({ itemId: i.id, countedQty: counts[i.id], batchNo: lots[i.id]?.batchNo || '', expiryDate: lots[i.id]?.expiryDate || '', binLocation: lots[i.id]?.binLocation || '', accountId: accounts[i.id] || '' }))
      .filter((c) => c.countedQty !== '' || c.batchNo || c.expiryDate || c.binLocation || c.accountId)
    const res = await fetch(`/api/stock-adjustments/${adj.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counts: payload }) })
    setBusy('')
    if (!res.ok) return setError((await res.json()).error || 'فشل الحفظ')
    router.refresh()
  }
  const post = async () => {
    if (!confirm('اعتماد وترحيل التسوية؟ هيتعمل قيد يومية آلي وتتقفل نهائيًا.')) return
    setBusy('post'); setError('')
    const res = await fetch(`/api/stock-adjustments/${adj.id}/post`, { method: 'POST' })
    setBusy('')
    if (!res.ok) return setError((await res.json()).error || 'فشل الترحيل')
    router.refresh()
  }
  const reverse = async () => {
    if (!confirm('إلغاء اعتماد التسوية؟ هيتعمل قيد عكسي وترجع الأرصدة.')) return
    setBusy('reverse'); setError('')
    const res = await fetch(`/api/stock-adjustments/${adj.id}/reverse`, { method: 'POST' })
    setBusy('')
    if (!res.ok) return setError((await res.json()).error || 'فشل الإلغاء')
    router.refresh()
  }
  const close = async () => {
    if (!confirm('إقفال المستند نهائيًا؟ مش هينفع ارتجاع أو تعديل بعد الإقفال.')) return
    setBusy('close'); setError('')
    const res = await fetch(`/api/stock-adjustments/${adj.id}/close`, { method: 'POST' })
    setBusy('')
    if (!res.ok) return setError((await res.json()).error || 'فشل الإقفال')
    router.refresh()
  }

  const st = STATUS[adj.status] || STATUS.DRAFT

  return (
    <div className="space-y-4">
      {/* الترويسة */}
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1a1a2e] tabular-nums flex items-center gap-2">{adj.docNo} <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span></h2>
            <p className="text-xs text-gray-500 mt-0.5">مخزن: {adj.warehouseName} · بواسطة {adj.createdByName}{adj.approvedByName ? ` · اعتمدها ${adj.approvedByName}` : ''}</p>
          </div>
          {adj.postingDate && <p className="text-[11px] text-gray-400 tabular-nums">تاريخ الترحيل: {new Date(adj.postingDate).toLocaleString('ar-EG')}</p>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
          <div><span className="text-gray-400 block">نوع التسوية</span><span className="font-semibold">{adj.adjustmentType === 'SHORTAGE_ONLY' ? 'عجز فقط' : adj.adjustmentType === 'SURPLUS_ONLY' ? 'زيادة فقط' : 'شاملة'}</span></div>
          <div><span className="text-gray-400 block">سبب التسوية</span><span className="font-semibold">{adj.reasonCode || '—'}</span></div>
          <div><span className="text-gray-400 block">إذن الجرد المرجعي</span><span className="font-semibold tabular-nums">{adj.stocktakeRef || '—'}</span></div>
          <div><span className="text-gray-400 block">عدد الأصناف</span><span className="font-semibold tabular-nums">{adj.items.length}</span></div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

      {/* إشعار الجرد الأعمى لأمين المخزن */}
      {blind && editable && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <p>جرد فعلي: اكتب الكمية اللي عدّيتها بالظبط لكل صنف. رصيد النظام والفروق مخفية عنك — المراجعة والاعتماد بيتمّوا من الإدارة.</p>
        </div>
      )}

      {/* تنبيه التزامن: حركات مخزنية حصلت بعد لقطة الجرد (للإدارة فقط) */}
      {!blind && editable && moved.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">فيه حركات مخزنية حصلت على {moved.length} صنف بعد لقطة الجرد — الترحيل بيتظبط تلقائيًا على الرصيد اللحظي.</p>
            <p className="mt-1 text-amber-700">{moved.slice(0, 6).map((m) => `${m.productName}: لقطة ${fmt(m.snapshotQty)} ← حالي ${fmt(m.liveQty)}`).join(' · ')}{moved.length > 6 ? ' …' : ''}</p>
          </div>
        </div>
      )}

      {/* ملخص الفروق (للإدارة فقط) */}
      {!blind && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100"><p className="text-[11px] text-gray-500">إجمالي العجز</p><p className="text-base font-bold text-red-600 tabular-nums">{money(editable ? short : adj.shortageCost)} ج.م</p></div>
          <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100"><p className="text-[11px] text-gray-500">إجمالي الزيادة</p><p className="text-base font-bold text-green-700 tabular-nums">{money(editable ? surplus : adj.surplusCost)} ج.م</p></div>
          <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100"><p className="text-[11px] text-gray-500">صافي الفرق</p><p className="text-base font-bold text-[#0f3460] tabular-nums">{money(editable ? surplus - short : adj.totalVarianceCost)} ج.م</p></div>
        </div>
      )}

      {/* جدول التسوية */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن صنف..." className="w-full pr-9 pl-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b border-gray-100 bg-gray-50/50 text-xs">
                <th className="px-3 py-2.5 font-medium">الصنف</th>
                {!blind && <th className="px-3 py-2.5 font-medium">الرصيد الدفتري</th>}
                <th className="px-3 py-2.5 font-medium">المعدود</th>
                {!blind && <th className="px-3 py-2.5 font-medium">الفرق</th>}
                {!blind && <th className="px-3 py-2.5 font-medium">تكلفة الوحدة</th>}
                {!blind && <th className="px-3 py-2.5 font-medium">قيمة الفرق</th>}
                {!blind && <th className="px-3 py-2.5 font-medium">الحالة</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((it) => {
                const v = editable ? liveVar(it) : Number(it.varianceQty)
                const action = v == null ? 'MATCHED' : v < 0 ? 'SHORTAGE' : v > 0 ? 'SURPLUS' : 'MATCHED'
                const cost = v == null ? 0 : Math.abs(v) * it.unitCost
                const act = ACTION[action]
                const showLot = !blind && it.lotTracked && (editable ? (v != null && v > 0) : (it.batchNo || it.expiryDate || it.binLocation))
                // توجيه محاسبي لكل سطر (للإدارة، في مرحلة المراجعة، للسطور اللي ليها فرق)
                const showAcct = !blind && editable && adj.status === 'REVIEWING' && v != null && v !== 0 && glAccounts.length > 0
                const showSub = showLot || showAcct
                const colSpan = blind ? 2 : 7
                return (
                  <Fragment key={it.id}>
                  <tr className={`border-b border-gray-50 ${showSub ? '' : 'last:border-0'}`}>
                    <td className="px-3 py-2 font-semibold text-[#1a1a2e]">{it.productName} <span className="text-[10px] text-gray-400 font-normal">{it.unit}</span>{!blind && it.lotTracked && <span className="mr-1 text-[9px] bg-purple-50 text-purple-600 px-1 py-0.5 rounded font-normal">لوت</span>}</td>
                    {!blind && <td className="px-3 py-2 tabular-nums text-gray-500">{fmt(it.snapshotQty)}{editable && Math.abs(it.liveQty - it.snapshotQty) > 0.0009 && <span className="block text-[10px] text-amber-600">حالي {fmt(it.liveQty)}</span>}</td>}
                    <td className="px-3 py-2">
                      {editable ? (
                        <input type="text" inputMode="decimal" dir="ltr" value={counts[it.id] ?? ''} onChange={(e) => setCounts({ ...counts, [it.id]: e.target.value })} placeholder="عدّ" className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg tabular-nums text-sm" />
                      ) : <span className="tabular-nums font-semibold">{it.countedQty != null ? fmt(it.countedQty) : '—'}</span>}
                    </td>
                    {!blind && <td className={`px-3 py-2 tabular-nums font-semibold ${v != null && v < 0 ? 'text-red-600' : v != null && v > 0 ? 'text-green-700' : 'text-gray-300'}`}>{v == null ? '—' : (v > 0 ? '+' : '') + fmt(v)}</td>}
                    {!blind && <td className="px-3 py-2 tabular-nums text-gray-500">{money(it.unitCost)}</td>}
                    {!blind && <td className="px-3 py-2 tabular-nums">{v == null || v === 0 ? '—' : money(cost)}</td>}
                    {!blind && <td className="px-3 py-2"><span className={`text-xs font-semibold ${act.cls}`}>{act.label}</span></td>}
                  </tr>
                  {showSub && (
                    <tr className="border-b border-gray-50 last:border-0 bg-gray-50/40">
                      <td colSpan={colSpan} className="px-3 py-2 space-y-2">
                        {showLot && (editable ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-purple-700 font-semibold">بيانات اللوت للزيادة:</span>
                            <input value={lots[it.id]?.batchNo ?? ''} onChange={(e) => setLot(it.id, 'batchNo', e.target.value)} placeholder="رقم اللوت *" className="w-32 px-2 py-1.5 border border-purple-200 rounded-lg text-sm" />
                            <input type="date" value={lots[it.id]?.expiryDate ?? ''} onChange={(e) => setLot(it.id, 'expiryDate', e.target.value)} dir="ltr" className="px-2 py-1.5 border border-purple-200 rounded-lg text-sm" />
                            <input value={lots[it.id]?.binLocation ?? ''} onChange={(e) => setLot(it.id, 'binLocation', e.target.value)} placeholder="الموقع/الرف" className="w-28 px-2 py-1.5 border border-purple-200 rounded-lg text-sm" />
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500"><span>لوت: <b className="text-gray-700">{it.batchNo || '—'}</b></span><span>صلاحية: <b className="text-gray-700">{it.expiryDate || '—'}</b></span><span>موقع: <b className="text-gray-700">{it.binLocation || '—'}</b></span></div>
                        ))}
                        {showAcct && (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[#0f3460] font-semibold">توجيه محاسبي (اختياري):</span>
                            <select value={accounts[it.id] ?? ''} onChange={(e) => setAccounts({ ...accounts, [it.id]: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm min-w-56">
                              <option value="">افتراضي ({v < 0 ? 'حساب العجز' : 'حساب الزيادة'})</option>
                              {glAccounts.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* القيد المحاسبي (بعد الترحيل، للإدارة فقط) */}
      {!blind && adj.journal && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"><Lock className="w-4 h-4 text-[#0f3460]" /><h3 className="font-bold text-sm text-[#1a1a2e]">القيد المحاسبي {adj.journal.entryNo}</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-right bg-gray-50/50 text-xs"><th className="px-4 py-2 font-medium">الحساب</th><th className="px-4 py-2 font-medium">مدين</th><th className="px-4 py-2 font-medium">دائن</th></tr></thead>
            <tbody>
              {adj.journal.lines.map((l, i) => (
                <tr key={i} className="border-t border-gray-50"><td className="px-4 py-2">{l.account}</td><td className="px-4 py-2 tabular-nums text-green-700">{l.debit > 0 ? money(l.debit) : '—'}</td><td className="px-4 py-2 tabular-nums text-red-600">{l.credit > 0 ? money(l.credit) : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* الأزرار */}
      <div className="flex flex-wrap gap-2">
        {editable && (
          <>
            <button onClick={saveCounts} disabled={busy === 'save'} className="bg-[#0f3460] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50 flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" /> {busy === 'save' ? 'جاري...' : (blind ? 'حفظ العدّ وإرساله للمراجعة' : 'حفظ العدّ ومراجعة الفروق')}</button>
            {/* الاعتماد والترحيل من الإدارة فقط */}
            {adj.isAdmin && adj.status === 'REVIEWING' && (
              <button onClick={post} disabled={busy === 'post'} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {busy === 'post' ? 'جاري...' : 'اعتماد وترحيل'}</button>
            )}
          </>
        )}
        {adj.status === 'POSTED' && adj.isAdmin && (
          <>
            <button onClick={reverse} disabled={busy === 'reverse'} className="bg-white border border-red-200 text-red-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5"><Undo2 className="w-4 h-4" /> {busy === 'reverse' ? 'جاري...' : 'إلغاء الاعتماد والارتجاع'}</button>
            <button onClick={close} disabled={busy === 'close'} className="bg-[#1a1a2e] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-black disabled:opacity-50 flex items-center gap-1.5"><Lock className="w-4 h-4" /> {busy === 'close' ? 'جاري...' : 'إقفال المستند نهائيًا'}</button>
          </>
        )}
        {adj.status === 'CLOSED' && (
          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl font-bold text-sm"><Lock className="w-4 h-4" /> مستند مغلق نهائيًا — مفيش تعديل أو ارتجاع</span>
        )}
        {!blind && <a href={`/print/stock-adjustment/${adj.id}`} target="_blank" rel="noopener" className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 flex items-center gap-1.5"><Printer className="w-4 h-4" /> طباعة المستند</a>}
      </div>
    </div>
  )
}
