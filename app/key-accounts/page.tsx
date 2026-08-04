import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { KeyAccountsManager } from '@/components/key-accounts-manager'
import { KeyAccountDispatchForm } from '@/components/key-account-dispatch-form'

export const dynamic = 'force-dynamic'

export default async function KeyAccountsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canAdd = canDoAction(perms, 'keyaccounts', 'add')

  const [accounts, products, warehouses] = await Promise.all([
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
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, include: { stocks: true } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">كبار الموردين (Key Accounts)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            بيوت الجملة بمقر رئيسي وفروع متعددة — بيانات أسعار توريد بحد أدنى، عقود، ومطالبات مجمّعة على المقر
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-white ring-1 ring-gray-200 text-[#0f3460] rounded-lg text-sm font-semibold hover:bg-gray-50 shrink-0"
        >
          <LayoutDashboard className="w-4 h-4" /> لوحة التحكم
        </Link>
      </div>

      {canAdd && (
        <KeyAccountDispatchForm
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            branches: a.branches.map((br) => ({ id: br.id, name: br.name })),
            quoteItems: (a.quotes[0]?.items || []).map((it) => ({ productId: it.productId, unitPrice: Number(it.unitPrice) })),
          }))}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            minKeyPrice: Number(p.minKeyPrice),
            stocks: p.stocks.map((s) => ({ warehouseId: s.warehouseId, quantity: Number(s.quantity) })),
          }))}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
        />
      )}

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
            subtotal: q.items.reduce((s, it) => s + Number(it.unitPrice) * (Number(it.quantity) || 0), 0),
          })),
          supplies: a.supplies.map((sp) => ({
            id: sp.id,
            supplyNo: sp.supplyNo,
            branchName: sp.branch.name,
            qty: sp.items.reduce((s, it) => s + Number(it.quantity), 0),
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
