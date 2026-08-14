import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PriceTrackingTable } from '@/components/price-tracking-table'

export const dynamic = 'force-dynamic'

// تتبّع أسعار الشراء: لكل صنف كل الأسعار من الفواتير والموردين — علشان المشتريات تحكم أفضل الأسعار
export default async function PriceTrackingPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const lines = await prisma.purchaseItem.findMany({
    include: {
      product: { select: { id: true, name: true, unit: true, costPrice: true } },
      purchase: { select: { invoiceNo: true, supplierInvoiceNo: true, createdAt: true, supplier: { select: { name: true } } } },
    },
    orderBy: { purchase: { createdAt: 'desc' } },
  })

  // تجميع حسب الصنف
  const byProduct = new Map<string, {
    productId: string; name: string; unit: string; costPrice: number
    entries: { supplier: string; invoiceNo: string; supplierInvoiceNo: string | null; date: string; quantity: number; unitPrice: number }[]
  }>()
  for (const l of lines) {
    const key = l.product.id
    if (!byProduct.has(key)) byProduct.set(key, { productId: key, name: l.product.name, unit: l.product.unit, costPrice: Number(l.product.costPrice), entries: [] })
    byProduct.get(key)!.entries.push({
      supplier: l.purchase.supplier.name,
      invoiceNo: l.purchase.invoiceNo,
      supplierInvoiceNo: l.purchase.supplierInvoiceNo,
      date: l.purchase.createdAt.toISOString(),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    })
  }

  const products = Array.from(byProduct.values()).map((p) => {
    const prices = p.entries.map((e) => e.unitPrice)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const last = p.entries[0]?.unitPrice ?? 0 // مرتّبة تنازليًا بالتاريخ
    const totalQty = p.entries.reduce((s, e) => s + e.quantity, 0)
    const totalVal = p.entries.reduce((s, e) => s + e.quantity * e.unitPrice, 0)
    const avg = totalQty > 0 ? totalVal / totalQty : 0
    const bestEntry = p.entries.reduce((b, e) => (e.unitPrice < b.unitPrice ? e : b), p.entries[0])
    return { ...p, min, max, last, avg, bestSupplier: bestEntry?.supplier || '—', invoiceCount: p.entries.length }
  }).sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/purchases" className="p-2 text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 rounded-lg" aria-label="رجوع">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">تتبّع أسعار الشراء</h1>
          <p className="text-sm text-gray-500 mt-0.5">كل الأسعار اللي اتشرى بيها كل صنف من الفواتير والموردين — أقل/أعلى/متوسط/آخر سعر لتحكم أفضل الأسعار</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-4"><p className="text-xs text-gray-500">أصناف اتشرت</p><p className="text-lg font-bold text-[#0f3460] tabular-nums">{products.length}</p></div>
        <div className="bg-white rounded-xl shadow-sm p-4"><p className="text-xs text-gray-500">إجمالي بنود الشراء</p><p className="text-lg font-bold text-[#0f3460] tabular-nums">{lines.length}</p></div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-green-600" /><div><p className="text-xs text-gray-500">أقل سعر</p><p className="text-sm font-bold text-green-700">أخضر = أرخص مورد</p></div></div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-red-500" /><div><p className="text-xs text-gray-500">أعلى سعر</p><p className="text-sm font-bold text-red-600">أحمر = أغلى فاتورة</p></div></div>
      </div>

      <PriceTrackingTable products={products} />
    </div>
  )
}
