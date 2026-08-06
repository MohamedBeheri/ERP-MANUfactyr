'use client'

import { Plus, Trash2, Paperclip } from 'lucide-react'

export interface PaymentLine {
  paymentMethodId: string
  treasuryId: string
  amount: string
  transactionReference: string
  attachment: string
}

interface TreasuryOption { id: string; name: string; balance: number }
interface MethodOption { id: string; name: string; type: 'CASH' | 'ELECTRONIC' | 'BANK' }

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] text-sm'

export const emptyPaymentLine = (methodId = '', treasuryId = ''): PaymentLine => ({
  paymentMethodId: methodId,
  treasuryId,
  amount: '',
  transactionReference: '',
  attachment: '',
})

function fileToDataUrl(file: File, maxSize = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', 0.75))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// محرر سطور سداد متعدد الوسائل: كل سطر وسيلة دفع + حساب/خزنة يتخصم منها + مبلغ + رقم مرجعي إجباري للوسائل غير النقدية + مرفق
export function PaymentLinesEditor({
  lines,
  onChange,
  treasuries,
  paymentMethods,
  maxAmount,
}: {
  lines: PaymentLine[]
  onChange: (lines: PaymentLine[]) => void
  treasuries: TreasuryOption[]
  paymentMethods: MethodOption[]
  maxAmount?: number
}) {
  const update = (i: number, field: keyof PaymentLine, value: string) => {
    onChange(lines.map((l, j) => (j === i ? { ...l, [field]: value } : l)))
  }
  const remove = (i: number) => onChange(lines.filter((_, j) => j !== i))
  const add = () => onChange([...lines, emptyPaymentLine(paymentMethods[0]?.id, treasuries[0]?.id)])

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const over = maxAmount !== undefined && total > maxAmount + 0.01

  const handleAttachment = async (i: number, file?: File) => {
    if (!file) return
    try { update(i, 'attachment', await fileToDataUrl(file)) } catch { /* تجاهل فشل ضغط الصورة */ }
  }

  return (
    <div className="space-y-2.5">
      {lines.map((l, i) => {
        const method = paymentMethods.find((m) => m.id === l.paymentMethodId)
        const needsRef = method && method.type !== 'CASH'
        const treasury = treasuries.find((t) => t.id === l.treasuryId)
        return (
          <div key={i} className="border border-gray-200 rounded-lg p-2.5 space-y-2 bg-gray-50/50">
            <div className="grid grid-cols-2 gap-2">
              <select value={l.paymentMethodId} onChange={(e) => update(i, 'paymentMethodId', e.target.value)} className={inputCls}>
                <option value="">وسيلة الدفع</option>
                {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={l.treasuryId} onChange={(e) => update(i, 'treasuryId', e.target.value)} className={inputCls}>
                <option value="">الحساب / الخزنة</option>
                {treasuries.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 items-start">
              <div>
                <input
                  type="text" inputMode="decimal" dir="ltr"
                  placeholder="المبلغ"
                  value={l.amount}
                  onChange={(e) => update(i, 'amount', e.target.value)}
                  className={`${inputCls} tabular-nums`}
                />
                {treasury && <p className="text-[10px] text-gray-400 mt-0.5">رصيد {treasury.name}: {treasury.balance.toLocaleString('ar-EG')} ج.م</p>}
              </div>
              <div>
                <input
                  placeholder={needsRef ? 'رقم العملية / المرجع *' : 'رقم مرجعي (اختياري)'}
                  value={l.transactionReference}
                  onChange={(e) => update(i, 'transactionReference', e.target.value)}
                  className={`${inputCls} ${needsRef && !l.transactionReference.trim() ? 'border-amber-400' : ''}`}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-[#0f3460]">
                <Paperclip className="w-3.5 h-3.5" />
                {l.attachment ? 'تغيير المرفق' : 'إرفاق إيصال (اختياري)'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAttachment(i, e.target.files?.[0])} />
              </label>
              <div className="flex items-center gap-2">
                {l.attachment && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.attachment} alt="مرفق" className="w-8 h-8 object-cover rounded border" />
                )}
                {lines.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button type="button" onClick={add} className="text-xs text-[#0f3460] font-medium flex items-center gap-1">
        <Plus className="w-3.5 h-3.5" /> إضافة وسيلة دفع تانية
      </button>

      {total > 0 && (
        <div className={`rounded-lg p-2.5 text-xs flex justify-between items-center ${over ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          <span>إجمالي السند</span>
          <span className="font-bold tabular-nums">{total.toLocaleString('ar-EG')} ج.م{maxAmount !== undefined && ` من ${maxAmount.toLocaleString('ar-EG')}`}</span>
        </div>
      )}
      {over && <p className="text-[11px] text-red-600">مجموع السطور أكبر من المبلغ المطلوب سداده</p>}
    </div>
  )
}
