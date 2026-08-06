'use client'

import { useState } from 'react'
import { Image as ImageIcon, Printer, Banknote } from 'lucide-react'
import Link from 'next/link'
import { PurchasePaymentPanel } from '@/components/purchase-payment-panel'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'مدفوعة بالكامل', cls: 'bg-green-50 text-green-600' },
  PARTIALLY_PAID: { label: 'مدفوعة جزئيًا', cls: 'bg-yellow-50 text-yellow-700' },
  UNPAID: { label: 'آجل', cls: 'bg-red-50 text-red-600' },
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export function PurchaseStatusCell({
  purchaseId, invoiceNo, supplierName, totalAmount, paidAmount, paymentStatus, paymentMethod, canEdit,
  treasuries, paymentMethods,
}: {
  purchaseId: string
  invoiceNo: string
  supplierName: string
  totalAmount: number
  paidAmount: number
  paymentStatus: string
  paymentMethod: string
  canEdit: boolean
  treasuries: { id: string; name: string }[]
  paymentMethods: { id: string; name: string; type: 'CASH' | 'ELECTRONIC' | 'BANK' }[]
}) {
  const [open, setOpen] = useState(false)
  const owed = totalAmount - paidAmount
  const meta = STATUS_META[paymentStatus] || STATUS_META.UNPAID

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className={`w-fit px-2 py-0.5 rounded text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
        {paidAmount > 0 && <span className="text-[10px] text-gray-400">{paymentMethod}</span>}
        {owed > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-red-600 tabular-nums">مستحق {fmt(owed)} ج.م</span>
            {canEdit && (
              <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[10px] text-white bg-[#0f3460] px-1.5 py-0.5 rounded font-semibold hover:bg-[#0a2545]">
                <Banknote className="w-3 h-3" /> سداد
              </button>
            )}
          </div>
        )}
      </div>
      {open && (
        <PurchasePaymentPanel
          purchaseId={purchaseId}
          invoiceNo={invoiceNo}
          supplierName={supplierName}
          totalAmount={totalAmount}
          paidAmount={paidAmount}
          treasuries={treasuries}
          paymentMethods={paymentMethods}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
