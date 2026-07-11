import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InvoiceForm } from '@/components/invoice-form'

export default async function SalesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [invoices, customers, products] = await Promise.all([
    prisma.invoice.findMany({
      include: { customer: true, items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { isActive: true, type: 'FINISHED' }, orderBy: { name: 'asc' } }),
  ])

  const totalCash = invoices.filter((i) => i.type === 'CASH').reduce((s, i) => s + Number(i.netAmount), 0)
  const totalCredit = invoices.filter((i) => i.type === 'CREDIT').reduce((s, i) => s + Number(i.netAmount), 0)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a2e]">🛒 المبيعات</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">إجمالي الفواتير</p>
          <p className="text-2xl font-bold text-[#1a1a2e]">{invoices.length}</p>
        </div>
        <div className="bg-green-50 p-5 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">نقدي</p>
          <p className="text-2xl font-bold text-green-600">{totalCash.toFixed(2)} ج.م</p>
        </div>
        <div className="bg-yellow-50 p-5 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">آجل</p>
          <p className="text-2xl font-bold text-yellow-700">{totalCredit.toFixed(2)} ج.م</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">📋 الفواتير</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-b border-gray-100">
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-semibold">{inv.invoiceNo}</td>
                    <td className="p-3">{inv.customer.name}</td>
                    <td className="p-3">{Number(inv.netAmount).toFixed(2)} ج.م</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${inv.type === 'CASH' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-700'}`}>
                        {inv.type === 'CASH' ? 'نقدي' : 'آجل'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400">{new Date(inv.createdAt).toLocaleDateString('ar-EG')}</td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-500">مفيش فواتير لسه.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <InvoiceForm
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            products={products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, sellPrice: Number(p.sellPrice), quantity: p.quantity }))}
          />

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-3">👥 العملاء</h3>
            <div className="space-y-2">
              {customers.map((c) => (
                <div key={c.id} className="flex justify-between text-sm pb-2 border-b border-gray-50 last:border-0">
                  <span>{c.name}</span>
                  <span className={Number(c.balance) > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                    {Number(c.balance).toFixed(2)} ج.م
                  </span>
                </div>
              ))}
              {customers.length === 0 && <p className="text-sm text-gray-500">مفيش عملاء.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
