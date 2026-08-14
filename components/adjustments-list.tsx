'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ChevronLeft, Lock } from 'lucide-react'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'مسودة', cls: 'bg-gray-100 text-gray-600' },
  IN_PROGRESS: { label: 'جاري العد', cls: 'bg-amber-50 text-amber-700' },
  REVIEWING: { label: 'مراجعة الفروق', cls: 'bg-blue-50 text-blue-700' },
  POSTED: { label: 'معتمد ومرحّل', cls: 'bg-green-50 text-green-700' },
  CLOSED: { label: 'مغلق', cls: 'bg-gray-200 text-gray-700' },
  REVERSED: { label: 'اتلغى اعتماده', cls: 'bg-red-50 text-red-600' },
}
const REASONS = ['تلف', 'خطأ إدخال سابق', 'تبخر/فقد طبيعي', 'عهدة شخصية']
const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460] bg-white'

interface Row { id: string; docNo: string; status: string; warehouseName: string; createdByName: string; totalVarianceCost: number; itemsCount: number; createdAt: string }

export function AdjustmentsList({ rows, warehouses, canEdit, isAdmin = false, periodLockDate = null }: {
  rows: Row[]
  warehouses: { id: string; name: string; isDefault: boolean }[]
  canEdit: boolean
  isAdmin?: boolean
  periodLockDate?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lockDate, setLockDate] = useState(periodLockDate || '')
  const [lockBusy, setLockBusy] = useState(false)
  const [lockMsg, setLockMsg] = useState('')

  const saveLock = async (value: string | null) => {
    setLockBusy(true); setLockMsg('')
    const res = await fetch('/api/accounting-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodLockDate: value }) })
    const data = await res.json(); setLockBusy(false)
    if (!res.ok) { setLockMsg(data.error || 'فشل الحفظ'); return }
    setLockDate(data.periodLockDate || '')
    setLockMsg(data.periodLockDate ? 'تم إقفال الفترة' : 'تم إلغاء الإقفال')
    router.refresh()
  }
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '')
  const [adjustmentType, setAdjustmentType] = useState('FULL')
  const [reasonCode, setReasonCode] = useState('')
  const [stocktakeRef, setStocktakeRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setBusy(true); setError('')
    const res = await fetch('/api/stock-adjustments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ warehouseId, adjustmentType, reasonCode, stocktakeRef }) })
    const data = await res.json(); setBusy(false)
    if (!res.ok) return setError(data.error || 'فشل بدء الجرد')
    router.push(`/warehouse/adjustments/${data.id}`)
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-2"><Lock className="w-4 h-4 text-[#0f3460]" /><h3 className="font-bold text-sm text-[#1a1a2e]">إقفال الفترة المحاسبية</h3></div>
          <p className="text-[11px] text-gray-500 mb-3">مينفعش ترحّل أي تسوية جرد بتاريخ داخل الفترة المقفولة (حتى التاريخ ده بما فيه). بيحمي البيانات المُقفلة من التعديل بأثر رجعي.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} dir="ltr" className={`${inputCls} max-w-[180px]`} />
            <button onClick={() => saveLock(lockDate || null)} disabled={lockBusy || !lockDate} className="bg-[#0f3460] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50">{lockBusy ? 'جاري...' : 'إقفال حتى هذا التاريخ'}</button>
            {periodLockDate && <button onClick={() => saveLock(null)} disabled={lockBusy} className="px-4 py-2.5 text-red-600 text-sm font-semibold hover:bg-red-50 rounded-xl disabled:opacity-50">إلغاء الإقفال</button>}
            {periodLockDate && <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg font-semibold">مقفول حتى {new Date(periodLockDate).toLocaleDateString('ar-EG')}</span>}
            {lockMsg && <span className="text-xs text-green-700">{lockMsg}</span>}
          </div>
        </div>
      )}
      {canEdit && (
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 border border-gray-100">
          {!open ? (
            <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-[#0f3460] font-bold text-sm"><Plus className="w-4 h-4" /> بدء تسوية جرد جديدة</button>
          ) : (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-[#1a1a2e]">بدء تسوية جرد جديدة</h3>
              {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-[11px] text-gray-500">المخزن المستهدف</label><select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                <div><label className="text-[11px] text-gray-500">نوع التسوية</label><select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)} className={inputCls}><option value="FULL">شاملة (عجز وزيادة)</option><option value="SHORTAGE_ONLY">عجز فقط</option><option value="SURPLUS_ONLY">زيادة فقط</option></select></div>
                <div><label className="text-[11px] text-gray-500">سبب التسوية</label><select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={inputCls}><option value="">— اختياري —</option>{REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                <div><label className="text-[11px] text-gray-500">إذن الجرد المرجعي</label><input value={stocktakeRef} onChange={(e) => setStocktakeRef(e.target.value)} placeholder="اختياري" className={inputCls} /></div>
              </div>
              <p className="text-[11px] text-gray-400">هياخد لقطة (Snapshot) للرصيد الدفتري الحالي لكل صنف في المخزن، وبعدها تدخل الكميات المعدودة.</p>
              <div className="flex gap-2">
                <button onClick={start} disabled={busy} className="bg-[#0f3460] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#0a2545] disabled:opacity-50">{busy ? 'جاري...' : 'بدء العدّ'}</button>
                <button onClick={() => setOpen(false)} className="px-4 py-2.5 text-gray-500 text-sm">إلغاء</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-sm text-[#1a1a2e]">مستندات التسوية</h3></div>
        {rows.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">مفيش تسويات جرد لسه</p> : (
          <div className="divide-y divide-gray-50">
            {rows.map((r) => {
              const st = STATUS[r.status] || STATUS.DRAFT
              return (
                <Link key={r.id} href={`/warehouse/adjustments/${r.id}`} className="flex items-center gap-3 p-3 sm:px-4 hover:bg-gray-50/60">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-[#0f3460] tabular-nums">{r.docNo} <span className="text-gray-400 font-normal">· {r.warehouseName} · {r.itemsCount} صنف</span></p>
                    <p className="text-[11px] text-gray-400 tabular-nums">{new Date(r.createdAt).toLocaleDateString('ar-EG')} · {r.createdByName}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                  <span className={`text-xs font-bold tabular-nums ${r.totalVarianceCost < 0 ? 'text-red-600' : r.totalVarianceCost > 0 ? 'text-green-700' : 'text-gray-400'}`}>{money(r.totalVarianceCost)} ج.م</span>
                  <ChevronLeft className="w-4 h-4 text-gray-300" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
