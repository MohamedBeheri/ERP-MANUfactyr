'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Banknote, History, CheckCircle2 } from 'lucide-react'
import { PaymentLinesEditor, emptyPaymentLine, type PaymentLine } from '@/components/payment-lines-editor'

interface TreasuryOption { id: string; name: string; balance: number }
interface MethodOption { id: string; name: string; type: 'CASH' | 'ELECTRONIC' | 'BANK' }
interface VoucherLine { id: string; amount: number; transactionReference: string | null; paymentMethod: { name: string }; treasury: { name: string } }
interface Voucher { id: string; voucherNo: string; amount: number; createdAt: string; createdBy: { name: string }; lines: VoucherLine[] }

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

// شاشة سداد لاحق (جزئي أو كامل) لفاتورة شراء موجودة + تاريخ سندات الصرف السابقة عليها
export function PurchasePaymentPanel({
  purchaseId,
  invoiceNo,
  supplierName,
  totalAmount,
  paidAmount,
  treasuries,
  paymentMethods,
  onClose,
}: {
  purchaseId: string
  invoiceNo: string
  supplierName: string
  totalAmount: number
  paidAmount: number
  treasuries: TreasuryOption[]
  paymentMethods: MethodOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [lines, setLines] = useState<PaymentLine[]>([emptyPaymentLine(paymentMethods[0]?.id, treasuries[0]?.id)])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const remaining = totalAmount - paidAmount

  const loadHistory = async () => {
    setLoadingHistory(true)
    const res = await fetch(`/api/purchases/${purchaseId}/vouchers`)
    if (res.ok) setVouchers(await res.json())
    setLoadingHistory(false)
  }
  useEffect(() => { loadHistory() }, [purchaseId])

  const submit = async () => {
    setError(''); setSuccess('')
    const validLines = lines.filter((l) => l.paymentMethodId && l.treasuryId && Number(l.amount) > 0)
    if (validLines.length === 0) { setError('أضف سطر سداد واحد على الأقل'); return }
    setLoading(true)
    const res = await fetch(`/api/purchases/${purchaseId}/vouchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lines: validLines.map((l) => ({
          paymentMethodId: l.paymentMethodId,
          treasuryId: l.treasuryId,
          amount: Number(l.amount),
          transactionReference: l.transactionReference || undefined,
          attachment: l.attachment || undefined,
        })),
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'فشل إنشاء سند الصرف'); return }
    setSuccess(`تم اعتماد السند ${data.voucherNo}`)
    setLines([emptyPaymentLine(paymentMethods[0]?.id, treasuries[0]?.id)])
    await loadHistory()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#e94560]" /> سداد فاتورة {invoiceNo}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 pb-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div><p className="text-gray-400">المورد</p><p className="font-bold text-[#1a1a2e] truncate">{supplierName}</p></div>
            <div><p className="text-gray-400">الإجمالي</p><p className="font-bold tabular-nums">{fmt(totalAmount)}</p></div>
            <div><p className="text-gray-400">المتبقي</p><p className="font-bold tabular-nums text-red-600">{fmt(remaining)}</p></div>
          </div>

          {remaining > 0.01 ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">سند صرف جديد</label>
              {error && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs">{error}</div>}
              {success && (
                <div className="bg-green-50 text-green-700 p-2.5 rounded-lg text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {success}
                </div>
              )}
              <PaymentLinesEditor lines={lines} onChange={setLines} treasuries={treasuries} paymentMethods={paymentMethods} maxAmount={remaining} />
              <button
                onClick={submit}
                disabled={loading}
                className="w-full bg-[#e94560] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-[#c73e54] disabled:opacity-50"
              >
                {loading ? 'جاري الاعتماد...' : 'اعتماد وحفظ السند'}
              </button>
            </div>
          ) : (
            <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm text-center font-semibold">الفاتورة مسدّدة بالكامل ✓</div>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2"><History className="w-4 h-4" /> سندات الصرف السابقة ({vouchers.length})</label>
            {loadingHistory && <p className="text-xs text-gray-400">جاري التحميل...</p>}
            {!loadingHistory && vouchers.length === 0 && <p className="text-xs text-gray-400">مفيش سندات صرف على الفاتورة دي لسه.</p>}
            <div className="space-y-2">
              {vouchers.map((v) => (
                <div key={v.id} className="border border-gray-100 rounded-lg p-2.5 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>{v.voucherNo}</span>
                    <span className="tabular-nums text-green-700">{fmt(v.amount)} ج.م</span>
                  </div>
                  <p className="text-gray-400 mt-0.5">{new Date(v.createdAt).toLocaleString('ar-EG')} — {v.createdBy.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {v.lines.map((l) => (
                      <span key={l.id} className="bg-gray-50 px-2 py-0.5 rounded text-[11px]">
                        {l.paymentMethod.name} {fmt(l.amount)} ({l.treasury.name}){l.transactionReference ? ` — ${l.transactionReference}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
