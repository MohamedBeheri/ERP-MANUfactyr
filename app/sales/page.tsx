import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Printer, ReceiptText } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Pos } from '@/components/pos'
import { ExportButtons } from '@/components/export-buttons'

export const dynamic = 'force-dynamic'

export default async function SalesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [invoices, customers, products, categories, warehouses] = await Promise.all([
    prisma.invoice.findMany({
      include: { customer: true, items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { isActive: true, type: 'FINISHED' }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ])

  const invoiceRows = invoices.map((inv) => [
    inv.invoiceNo,
    inv.customer.name,
    Number(inv.netAmount).toFixed(2),
    inv.type === 'CASH' ? 'نقدي' : 'آجل',
    new Date(inv.createdAt).toLocaleDateString('ar-EG'),
    inv.creator.name,
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">نقطة البيع</h1>
        <p className="text-sm text-gray-500 mt-0.5">اختار المنتجات ← راجع الفاتورة ← أكّد البيع واطبعها</p>
      </div>

      <Pos
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          sellPrice: Number(p.sellPrice),
          wholesalePrice: Number(p.wholesalePrice),
          quantity: p.quantity,
          categoryId: p.categoryId,
          imageUrl: p.imageUrl,
        }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name, customerType: c.customerType }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
      />

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
                    {inv.items.map((i) => `${i.product.name} ×${i.quantity}`).join('، ')}
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
