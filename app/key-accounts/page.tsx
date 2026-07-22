import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KeyAccountsManager } from '@/components/key-accounts-manager'

export const dynamic = 'force-dynamic'

export default async function KeyAccountsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [accounts, products] = await Promise.all([
    prisma.keyAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        branches: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        quotes: {
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } },
        },
        supplies: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { branch: true, items: true },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">كبار الموردين (Key Accounts)</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          بيوت الجملة بمقر رئيسي وفروع متعددة — بيانات أسعار توريد بحد أدنى، عقود، ومطالبات مجمّعة على المقر
        </p>
      </div>

      <KeyAccountsManager
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          brandName: a.brandName,
          activityType: a.activityType,
          phone: a.phone,
          address: a.address,
          balance: Number(a.balance),
          totalPurchases: Number(a.totalPurchases),
          notes: a.notes,
          branches: a.branches.map((br) => ({
            id: br.id,
            name: br.name,
            address: br.address,
            phone: br.phone,
            manager: br.manager,
          })),
          quotes: a.quotes.map((q) => ({
            id: q.id,
            quoteNo: q.quoteNo,
            status: q.status,
            discountType: q.discountType,
            discountPercent: Number(q.discountPercent),
            createdAt: q.createdAt.toISOString(),
            itemsCount: q.items.length,
            subtotal: q.items.reduce((s, it) => s + Number(it.unitPrice) * (it.quantity || 0), 0),
          })),
          supplies: a.supplies.map((sp) => ({
            id: sp.id,
            supplyNo: sp.supplyNo,
            branchName: sp.branch.name,
            qty: sp.items.reduce((s, it) => s + it.quantity, 0),
            netAmount: Number(sp.netAmount),
            createdAt: sp.createdAt.toISOString(),
          })),
          payments: a.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            method: p.method,
            createdAt: p.createdAt.toISOString(),
          })),
        }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          wholesalePrice: Number(p.wholesalePrice),
          minKeyPrice: Number(p.minKeyPrice),
        }))}
      />
    </div>
  )
}
