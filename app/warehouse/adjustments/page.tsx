import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { AdjustmentsList } from '@/components/adjustments-list'

export const dynamic = 'force-dynamic'

export default async function AdjustmentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canEdit = canDoAction(perms, 'warehouse', 'edit')

  const [rows, warehouses, acctSettings] = await Promise.all([
    prisma.stockAdjustment.findMany({
      include: { warehouse: { select: { name: true } }, createdBy: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.accountingSettings.findFirst(),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/warehouse" className="p-2 text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 rounded-lg" aria-label="رجوع"><ArrowRight className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">جرد المخزن والتسويات</h1>
          <p className="text-sm text-gray-500 mt-0.5">أمين المخزن بيعدّ الأصناف فعليًا · الإدارة بتراجع وتعتمد (مباشر أو بتسوية محاسبية)</p>
        </div>
      </div>

      <AdjustmentsList
        rows={rows.map((r) => ({
          id: r.id, docNo: r.docNo, status: r.status, warehouseName: r.warehouse.name,
          createdByName: r.createdBy.name, totalVarianceCost: Number(r.totalVarianceCost),
          itemsCount: r._count.items, createdAt: r.createdAt.toISOString(),
        }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
        canEdit={canEdit}
        isAdmin={session.user.role === 'ADMIN'}
        periodLockDate={acctSettings?.periodLockDate?.toISOString().slice(0, 10) || null}
      />
    </div>
  )
}
