import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ensureTiers } from '@/lib/tiers'
import { CustomersManager } from '@/components/customers-manager'

export const dynamic = 'force-dynamic'

const ONLINE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'جديد', CONFIRMED: 'مؤكّد', PREPARING: 'بيتجهّز', SHIPPED: 'خرج للتوصيل', DELIVERED: 'اتسلّم', CANCELLED: 'اتلغى',
}
const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'مسودة', COMPLETED: 'مكتملة', CANCELLED: 'ملغية', REFUNDED: 'مرتجعة',
}

export default async function CustomersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canAdd = canDoAction(perms, 'customers', 'add')
  const canEdit = canDoAction(perms, 'customers', 'edit')
  const canDelete = canDoAction(perms, 'customers', 'delete')

  await ensureTiers()

  const tiers = await prisma.customerTier.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }] })

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    include: {
      tier: true,
      invoices: {
        select: {
          id: true, invoiceNo: true, netAmount: true, paidAmount: true, type: true,
          paymentMethod: true, collectionMethod: true, status: true, createdAt: true,
          items: { where: { isBonus: false }, select: { quantity: true, product: { select: { name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' }, take: 10,
      },
      onlineOrders: {
        select: {
          id: true, orderNo: true, total: true, paymentMethod: true, status: true, createdAt: true,
          items: { select: { quantity: true, productName: true } },
        },
        orderBy: { createdAt: 'desc' }, take: 10,
      },
      _count: { select: { invoices: true, onlineOrders: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  const totalDebt = customers.reduce((s, c) => s + Number(c.balance), 0)
  const totalPurchases = customers.reduce((s, c) => s + Number(c.totalPurchases), 0)
  const wholesale = customers.filter((c) => c.customerType === 'WHOLESALE').length

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">العملاء</h1>
        <p className="text-sm text-gray-500 mt-0.5">بروفايل كامل لكل عميل — مشترياته وطلباته ومديونيته وتواصل مباشر</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          <p className="text-2xl font-bold text-green-600 tabular-nums">{totalPurchases.toLocaleString('ar-EG')} ج.م</p>
          <p className="text-xs text-gray-500">إجمالي المشتريات</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-2xl font-bold text-red-600 tabular-nums">{totalDebt.toLocaleString('ar-EG')} ج.م</p>
          <p className="text-xs text-gray-500">إجمالي المديونيات</p>
        </div>
      </div>

      <CustomersManager
        tiers={tiers.map((t) => ({ id: t.id, name: t.name }))}
        canAdd={canAdd}
        canEdit={canEdit}
        canDelete={canDelete}
        customers={customers.map((c) => {
          const lastOrders = [
            ...c.invoices.map((i) => {
              const total = Number(i.netAmount)
              const paid = Number(i.paidAmount)
              const remaining = Math.max(0, total - paid)
              return {
                id: i.id, no: i.invoiceNo, total, paid, remaining, date: i.createdAt.toISOString(), source: 'محل' as const,
                paymentType: i.type === 'CREDIT' ? 'آجل' : 'نقدي',
                paymentMethod: i.collectionMethod ? `${i.paymentMethod} — ${i.collectionMethod}` : i.paymentMethod,
                statusLabel: i.status !== 'COMPLETED' ? INVOICE_STATUS_LABEL[i.status] : (remaining <= 0 ? 'مدفوعة بالكامل' : paid > 0 ? 'مدفوعة جزئيًا' : 'غير مدفوعة (آجل)'),
                statusTone: i.status === 'CANCELLED' || i.status === 'REFUNDED' ? 'gray' : remaining <= 0 ? 'green' : paid > 0 ? 'amber' : 'red',
                items: i.items.map((it) => ({ name: it.product.name, qty: Number(it.quantity), unit: it.product.unit })),
                printHref: `/print/invoice/${i.id}`,
              }
            }),
            ...c.onlineOrders.map((o) => ({
              id: o.id, no: o.orderNo, total: Number(o.total), paid: null, remaining: null, date: o.createdAt.toISOString(), source: 'أونلاين' as const,
              paymentType: null, paymentMethod: o.paymentMethod,
              statusLabel: ONLINE_STATUS_LABEL[o.status] || o.status,
              statusTone: o.status === 'DELIVERED' ? 'green' : o.status === 'CANCELLED' ? 'gray' : 'amber',
              items: o.items.map((it) => ({ name: it.productName, qty: Number(it.quantity), unit: '' })),
              printHref: null,
            })),
          ]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10)
          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            customerType: c.customerType,
            area: c.area,
            governorate: c.governorate,
            lat: c.lat ? Number(c.lat) : null,
            lng: c.lng ? Number(c.lng) : null,
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
