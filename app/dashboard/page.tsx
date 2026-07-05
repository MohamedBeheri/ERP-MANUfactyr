import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardStats } from '@/components/dashboard-stats'
import { RecentActivity } from '@/components/recent-activity'
import { SalesChart } from '@/components/sales-chart'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const totalInventory = await prisma.product.aggregate({
    where: { type: 'FINISHED' },
    _sum: { quantity: true },
  })

  const totalSales = await prisma.invoice.aggregate({
    _sum: { netAmount: true },
  })

  const activeDelegates = await prisma.delegate.count({
    where: { isActive: true },
  })

  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { quantity: true, minStock: true },
  })
  const lowStock = allProducts.filter((p) => p.quantity <= p.minStock).length

  const recentActivity = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

  const salesData = await prisma.invoice.groupBy({
    by: ['createdAt'],
    _sum: { netAmount: true },
    orderBy: { createdAt: 'asc' },
    take: 30,
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#1a1a2e] mb-6">لوحة التحكم</h1>
      <DashboardStats
        totalInventory={totalInventory._sum.quantity || 0}
        totalSales={totalSales._sum.netAmount?.toNumber() || 0}
        activeDelegates={activeDelegates}
        alerts={lowStock}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <SalesChart data={salesData} />
        <RecentActivity activities={recentActivity} />
      </div>
    </div>
  )
}
