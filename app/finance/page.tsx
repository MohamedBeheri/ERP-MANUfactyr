import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExportButtons } from '@/components/export-buttons'

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [totalSales, totalPurchases, cashSales, creditSales, customers, cashFlow] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { netAmount: true }, where: { status: 'COMPLETED' } }),
    prisma.purchase.aggregate({ _sum: { totalAmount: true } }),
    prisma.invoice.aggregate({ _sum: { netAmount: true }, where: { type: 'CASH', status: 'COMPLETED' } }),
    prisma.invoice.aggregate({ _sum: { netAmount: true }, where: { type: 'CREDIT', status: 'COMPLETED' } }),
    prisma.customer.findMany({ where: { balance: { gt: 0 } }, orderBy: { balance: 'desc' }, take: 10 }),
    prisma.cashFlow.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ])

  const sales = Number(totalSales._sum.netAmount) || 0
  const purchases = Number(totalPurchases._sum.totalAmount) || 0
  const cash = Number(cashSales._sum.netAmount) || 0
  const credit = Number(creditSales._sum.netAmount) || 0
  const profit = sales - purchases
  const totalDebt = customers.reduce((s, c) => s + Number(c.balance), 0)

  const summaryRows: (string | number)[][] = [
    ['إجمالي المبيعات', sales.toFixed(2)],
    ['إجمالي المشتريات', purchases.toFixed(2)],
    ['صافي الربح', profit.toFixed(2)],
    ['مبيعات نقدية', cash.toFixed(2)],
    ['مبيعات آجلة', credit.toFixed(2)],
    ['إجمالي الديون', totalDebt.toFixed(2)],
    ...customers.map((c): (string | number)[] => [`مديونية: ${c.name}`, Number(c.balance).toFixed(2)]),
  ]

  return (
    <div className="p-6 space-y-6 print-area">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">التقارير المالية</h1>
        <ExportButtons fileName="التقرير-المالي" headers={['البيان', 'القيمة (ج.م)']} rows={summaryRows} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">إجمالي المبيعات</p>
          <p className="text-2xl font-bold text-green-600">{sales.toFixed(2)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">إجمالي المشتريات</p>
          <p className="text-2xl font-bold text-red-600">{purchases.toFixed(2)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">صافي الربح</p>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profit.toFixed(2)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">إجمالي الديون</p>
          <p className="text-2xl font-bold text-yellow-700">{totalDebt.toFixed(2)} ج.م</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">تفصيل المبيعات</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">مبيعات نقدية</span>
              <span className="font-bold text-green-600">{cash.toFixed(2)} ج.م</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="bg-green-500 h-3 rounded-full" style={{ width: sales > 0 ? `${(cash / sales) * 100}%` : '0%' }} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">مبيعات آجلة</span>
              <span className="font-bold text-yellow-700">{credit.toFixed(2)} ج.م</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="bg-yellow-500 h-3 rounded-full" style={{ width: sales > 0 ? `${(credit / sales) * 100}%` : '0%' }} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">أكبر المديونيات</h3>
          <div className="space-y-3">
            {customers.length === 0 && <p className="text-sm text-gray-500">مفيش مديونيات.</p>}
            {customers.map((c) => (
              <div key={c.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.phone || '—'}</p>
                </div>
                <span className="font-bold text-red-600">{Number(c.balance).toFixed(2)} ج.م</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {cashFlow.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">التدفق النقدي</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-b border-gray-100">
                  <th className="p-3">الوصف</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">الرصيد</th>
                  <th className="p-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {cashFlow.map((cf) => (
                  <tr key={cf.id} className="border-b border-gray-50 last:border-0">
                    <td className="p-3">{cf.description}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${cf.type === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {cf.type === 'IN' ? 'وارد' : 'صادر'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold">{Number(cf.amount).toFixed(2)} ج.م</td>
                    <td className="p-3">{Number(cf.balance).toFixed(2)} ج.م</td>
                    <td className="p-3 text-gray-400">{new Date(cf.createdAt).toLocaleDateString('ar-EG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
