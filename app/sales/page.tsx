import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Printer, ReceiptText, Coffee, ArrowLeft } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExportButtons } from '@/components/export-buttons'

export const dynamic = 'force-dynamic'

export default async function SalesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const invoices = await prisma.invoice.findMany({
    include: { customer: true, items: { include: { product: true } }, creator: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  const invoiceRows = invoices.map((inv) => [
    inv.invoiceNo,
    inv.customer.name,
    Number(inv.netAmount).toFixed(2),
    inv.type === 'CASH' ? 'نقدي' : 'آجل',
    new Date(inv.createdAt).toLocaleDateString('ar-EG'),
    inv.creator.name,
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">المبيعات</h1>
        <p className="text-sm text-gray-500 mt-0.5">سجل فواتير البيع — نقطة البيع اتنقلت لشاشة الكافيه</p>
      </div>

      {/* نقطة البيع دلوقتي جوه شاشة الكافيه */}
      <Link
        href="/cafe"
        className="flex items-center justify-between gap-3 bg-gradient-to-l from-[#1a1a2e] to-[#0f3460] text-white rounded-xl p-5 hover:opacity-95 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Coffee className="w-6 h-6 text-[#e9b44c]" />
          </div>
          <div>
            <p className="font-bold">نقطة البيع</p>
            <p className="text-sm text-white/70">افتح شاشة الكافيه وبيع كل الأصناف (بن + منتجات الكافيه) من تبويب نقطة البيع</p>
          </div>
        </div>
        <ArrowLeft className="w-5 h-5 shrink-0" />
      </Link>

      {/* سجل الفواتير */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden print-area">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-[#0f3460]" />
            <h3 className="text-base font-bold text-[#1a1a2e]">سجل الفواتير</h3>
            <span className="text-xs text-gray-400">(آخر {invoices.length})</span>
          </div>
          <ExportButtons
            fileName="فواتير-المبيعات"
            headers={['رقم الفاتورة', 'العميل', 'الصافي', 'النوع', 'التاريخ', 'البائع']}
            rows={invoiceRows}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                <th className="p-3 font-medium">رقم الفاتورة</th>
                <th className="p-3 font-medium">العميل</th>
                <th className="p-3 font-medium">الأصناف</th>
                <th className="p-3 font-medium">الصافي</th>
                <th className="p-3 font-medium">النوع</th>
                <th className="p-3 font-medium">التاريخ</th>
                <th className="p-3 font-medium no-print">طباعة</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="p-3 font-semibold tabular-nums">{inv.invoiceNo}</td>
                  <td className="p-3">{inv.customer.name}</td>
                  <td className="p-3 text-gray-500 text-xs">
                    {inv.items.map((i) => `${i.product.name} ×${Number(i.quantity)}`).join('، ')}
                  </td>
                  <td className="p-3 font-bold tabular-nums">{Number(inv.netAmount).toLocaleString('ar-EG')} ج.م</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${inv.type === 'CASH' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-700'}`}>
                      {inv.type === 'CASH' ? inv.paymentMethod : 'آجل'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 text-xs tabular-nums">{new Date(inv.createdAt).toLocaleDateString('ar-EG')}</td>
                  <td className="p-3 no-print">
                    <Link
                      href={`/print/invoice/${inv.id}`}
                      className="inline-flex items-center gap-1 text-xs text-[#0f3460] font-medium hover:underline"
                    >
                      <Printer className="w-3.5 h-3.5" /> فاتورة
                    </Link>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">مفيش فواتير لسه.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
