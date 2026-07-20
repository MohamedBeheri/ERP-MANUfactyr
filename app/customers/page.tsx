import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureTiers } from '@/lib/tiers'
import { CustomersManager } from '@/components/customers-manager'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  await ensureTiers()

  const tiers = await prisma.customerTier.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }] })

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    include: {
      tier: true,
      invoices: { select: { invoiceNo: true, netAmount: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 },
      onlineOrders: { select: { orderNo: true, total: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { invoices: true, onlineOrders: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  const totalDebt = customers.reduce((s, c) => s + Number(c.balance), 0)
  const wholesale = customers.filter((c) => c.customerType === 'WHOLESALE').length

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">العملاء</h1>
        <p className="text-sm text-gray-500 mt-0.5">بروفايل كامل لكل عميل — مشترياته وطلباته ومديونيته وتواصل مباشر</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-[#1a1a2e] tabular-nums">{customers.length}</p>
          <p className="text-xs text-gray-500">إجمالي العملاء</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-blue-600 tabular-nums">{wholesale}</p>
          <p className="text-xs text-gray-500">عملاء جملة</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-gray-600 tabular-nums">{customers.length - wholesale}</p>
          <p className="text-xs text-gray-500">عملاء قطاعي</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-red-600 tabular-nums">{totalDebt.toLocaleString('ar-EG')} ج.م</p>
          <p className="text-xs text-gray-500">إجمالي المديونيات</p>
        </div>
      </div>

      <CustomersManager
        tiers={tiers.map((t) => ({ id: t.id, name: t.name }))}
        customers={customers.map((c) => {
          const lastOrders = [
            ...c.invoices.map((i) => ({ no: i.invoiceNo, total: Number(i.netAmount), date: i.createdAt.toISOString(), source: 'محل' })),
            ...c.onlineOrders.map((o) => ({ no: o.orderNo, total: Number(o.total), date: o.createdAt.toISOString(), source: 'أونلاين' })),
          ]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 6)
          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            customerType: c.customerType,
            tierId: c.tierId,
            tierName: c.tier?.name || null,
            bonusPoints: Number(c.bonusPoints),
            balance: Number(c.balance),
            totalPurchases: Number(c.totalPurchases),
            creditLimit: Number(c.creditLimit),
            createdAt: c.createdAt.toISOString(),
            invoiceCount: c._count.invoices,
            onlineCount: c._count.onlineOrders,
            lastOrders,
          }
        })}
      />
    </div>
  )
}
