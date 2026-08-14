import { AlBadrLogo } from '@/components/albadr-logo'

const money = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
const fmt = (n: number) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 3 })

export interface ReceiptLine { name: string; quantity: number; unit?: string; unitPrice: number }

// إيصال كاشير حراري (عرض 80مم) — للطباعة على ماكينة الكاشير
export function CashierReceipt({
  title = 'إيصال بيع',
  docNo,
  date,
  cashier,
  buyer,
  lines,
  totalLabel = 'الإجمالي',
  total,
  paymentMethod,
  footer = 'شكراً لتعاملكم معنا',
}: {
  title?: string
  docNo: string
  date: Date | string
  cashier?: string
  buyer?: string | null
  lines: ReceiptLine[]
  totalLabel?: string
  total: number
  paymentMethod?: string
  footer?: string
}) {
  const d = new Date(date)
  return (
    <div className="receipt-80 bg-white mx-auto text-[#000] p-3" style={{ width: '80mm', maxWidth: '80mm', fontFamily: 'inherit' }}>
      {/* حجم ورق الطباعة = 80مم (ماكينة الكاشير) */}
      <style>{`@media print { @page { size: 80mm auto; margin: 0; } }`}</style>
      <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
        <AlBadrLogo className="w-12 h-12 mx-auto text-[#1a1a2e]" />
        <p className="font-bold text-sm mt-1">شركة البدر لتجارة البن</p>
        <p className="text-[10px] text-gray-600">Al Badr Coffee</p>
        <p className="text-[11px] font-bold mt-1">{title}</p>
      </div>

      <div className="text-[10px] space-y-0.5 mb-2">
        <div className="flex justify-between"><span>رقم</span><span className="tabular-nums">{docNo}</span></div>
        <div className="flex justify-between"><span>التاريخ</span><span className="tabular-nums">{d.toLocaleDateString('ar-EG')} {d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></div>
        {cashier && <div className="flex justify-between"><span>الكاشير</span><span>{cashier}</span></div>}
        {buyer && <div className="flex justify-between"><span>العميل</span><span>{buyer}</span></div>}
        {paymentMethod && <div className="flex justify-between"><span>الدفع</span><span>{paymentMethod}</span></div>}
      </div>

      <table className="w-full text-[10px] border-t border-dashed border-gray-400">
        <thead>
          <tr className="border-b border-dashed border-gray-400">
            <th className="text-right py-1 font-bold">الصنف</th>
            <th className="text-center py-1 font-bold">كمية</th>
            <th className="text-center py-1 font-bold">سعر</th>
            <th className="text-left py-1 font-bold">إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5 pl-1">{l.name}</td>
              <td className="py-0.5 text-center tabular-nums">{fmt(l.quantity)}</td>
              <td className="py-0.5 text-center tabular-nums">{money(l.unitPrice)}</td>
              <td className="py-0.5 text-left tabular-nums">{money(l.quantity * l.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-gray-400 mt-1 pt-1 flex justify-between text-xs font-bold">
        <span>{totalLabel}</span>
        <span className="tabular-nums">{money(total)} ج.م</span>
      </div>

      <p className="text-center text-[10px] text-gray-600 mt-3 border-t border-dashed border-gray-400 pt-2">{footer}</p>
    </div>
  )
}
