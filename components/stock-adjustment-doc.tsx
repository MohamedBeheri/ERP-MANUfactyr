'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ClipboardCheck, CheckCircle2, Undo2, Lock } from 'lucide-react'

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

interface Item { id: string; productName: string; unit: string; snapshotQty: number; countedQty: number | null; varianceQty: number; unitCost: number; varianceCost: number; action: string }
interface Adj {
  id: string; docNo: string; status: string; adjustmentType: string; reasonCode: string | null; stocktakeRef: string | null
  warehouseName: string; createdByName: string; approvedByName: string | null; postingDate: string | null
  shortageCost: number; surplusCost: number; totalVarianceCost: number
  journal: { entryNo: string; lines: { account: string; debit: number; credit: number }[] } | null
  items: Item[]
  isAdmin: boolean
}

export function StockAdjustmentDoc({ adj }: { adj: Adj }) {
  const router = useRouter()
  const editable = adj.status === 'IN_PROGRESS' || adj.status === 'REVIEWING'
  const [counts, setCounts] = useState<Record<string, string>>(
    Object.fromEntries(adj.items.map((i) => [i.id, i.countedQty != null ? String(i.countedQty) : '']))
  )
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const list = search.trim() ? adj.items.filter((i) => i.productName.includes(search.trim())) : adj.items

  // حساب لايف من المدخلات
  const liveVar = (it: Item) => { const c = counts[it.id]; if (c === '' || c == null) return null; return +(Number(c) - it.snapshotQty).toFixed(3) }
  let short = 0, surplus = 0
  for (const it of adj.items) { const v = liveVar(it); if (v == null) continue; const cost = Math.abs(v) * it.unitCost; if (v < 0) short += cost; else if (v > 0) surplus += cost }

  const saveCounts = async () => {
    setBusy('save'); setError('')
    const payload = adj.items.map((i) => ({ itemId: i.id, countedQty: counts[i.id] })).filter((c) => c.countedQty !== '')
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

      {/* ملخص الفروق */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100"><p className="text-[11px] text-gray-500">إجمالي العجز</p><p className="text-base font-bold text-red-600 tabular-nums">{money(editable ? short : adj.shortageCost)} ج.م</p></div>
        <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100"><p className="text-[11px] text-gray-500">إجمالي الزيادة</p><p className="text-base font-bold text-green-700 tabular-nums">{money(editable ? surplus : adj.surplusCost)} ج.م</p></div>
        <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100"><p className="text-[11px] text-gray-500">صافي الفرق</p><p className="text-base font-bold text-[#0f3460] tabular-nums">{money(editable ? surplus - short : adj.totalVarianceCost)} ج.م</p></div>
      </div>

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
                <th className="px-3 py-2.5 font-medium">الرصيد الدفتري</th>
                <th className="px-3 py-2.5 font-medium">المعدود</th>
                <th className="px-3 py-2.5 font-medium">الفرق</th>
                <th className="px-3 py-2.5 font-medium">تكلفة الوحدة</th>
                <th className="px-3 py-2.5 font-medium">قيمة الفرق</th>
                <th className="px-3 py-2.5 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((it) => {
                const v = editable ? liveVar(it) : Number(it.varianceQty)
                const action = v == null ? 'MATCHED' : v < 0 ? 'SHORTAGE' : v > 0 ? 'SURPLUS' : 'MATCHED'
                const cost = v == null ? 0 : Math.abs(v) * it.unitCost
                const act = ACTION[action]
                return (
                  <tr key={it.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 font-semibold text-[#1a1a2e]">{it.productName} <span className="text-[10px] text-gray-400 font-normal">{it.unit}</span></td>
                    <td className="px-3 py-2 tabular-nums text-gray-500">{fmt(it.snapshotQty)}</td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <input type="text" inputMode="decimal" dir="ltr" value={counts[it.id] ?? ''} onChange={(e) => setCounts({ ...counts, [it.id]: e.target.value })} placeholder="عدّ" className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg tabular-nums text-sm" />
                      ) : <span className="tabular-nums font-semibold">{it.countedQty != null ? fmt(it.countedQty) : '—'}</span>}
                    </td>
                    <td className={`px-3 py-2 tabular-nums font-semibold ${v != null && v < 0 ? 'text-red-600' : v != null && v > 0 ? 'text-green-700' : 'text-gray-300'}`}>{v == null ? '—' : (v > 0 ? '+' : '') + fmt(v)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500">{money(it.unitCost)}</td>
                    <td className="px-3 py-2 tabular-nums">{v == null || v === 0 ? '—' : money(cost)}</td>
                    <td className="px-3 py-2"><span className={`text-xs font-semibold ${act.cls}`}>{act.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* القيد المحاسبي (بعد الترحيل) */}
      {adj.journal && (
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
            <button onClick={saveCounts} disabled={busy === 'save'} className="bg-[#0f3460] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50 flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" /> {busy === 'save' ? 'جاري...' : 'حفظ العدّ ومراجعة الفروق'}</button>
            {adj.status === 'REVIEWING' && (
              <button onClick={post} disabled={busy === 'post'} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {busy === 'post' ? 'جاري...' : 'اعتماد وترحيل'}</button>
            )}
          </>
        )}
        {adj.status === 'POSTED' && adj.isAdmin && (
          <button onClick={reverse} disabled={busy === 'reverse'} className="bg-white border border-red-200 text-red-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5"><Undo2 className="w-4 h-4" /> {busy === 'reverse' ? 'جاري...' : 'إلغاء الاعتماد والارتجاع'}</button>
        )}
      </div>
    </div>
  )
}
