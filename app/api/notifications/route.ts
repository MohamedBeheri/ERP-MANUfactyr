import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, hasSectionAccess } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// إشعارات حيّة: بتحسب البنود المحتاجة أكشن دلوقتي عبر كل الأقسام حسب صلاحية المستخدم
// كل مجموعة ليها section (مفتاح الصلاحية) عشان القائمة الجانبية تحط العلامة على التاب الصح
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const isAdmin = session.user.role === 'ADMIN'
  const has = (s: string) => hasSectionAccess(perms, s)

  const groups: { section: string; label: string; count: number; href: string; tone: 'action' | 'warn' }[] = []
  const push = (section: string, label: string, count: number, href: string, tone: 'action' | 'warn' = 'action') => {
    if (count > 0) groups.push({ section, label, count, href, tone })
  }

  const now = new Date()

  // ===== الخزنة: تسويات معلقة =====
  if (has('treasury')) {
    const [pendingSettlements, overdueInstallments] = await Promise.all([
      prisma.treasurySettlement.count({ where: { status: 'PENDING' } }),
      prisma.installment.count({ where: { status: { not: 'PAID' }, dueDate: { lt: now } } }),
    ])
    push('treasury', 'تسويات خزنة بانتظار الاعتماد', pendingSettlements, '/treasury')
    push('treasury', 'أقساط متأخرة عن السداد', overdueInstallments, '/treasury', 'warn')

    // عُهد بانتظار اعتماد الإدارة (للأدمن) + مصروفات عُهد بانتظار الاعتماد
    if (isAdmin) {
      const pendingCustodies = await prisma.custody.count({ where: { status: 'PENDING' } })
      push('treasury', 'طلبات عُهد بانتظار اعتمادك', pendingCustodies, '/treasury')
    }
    const [approvedToDisburse, pendingExpenses] = await Promise.all([
      prisma.custody.count({ where: { status: 'APPROVED' } }),
      prisma.custodyExpense.count({ where: { status: 'PENDING' } }),
    ])
    push('treasury', 'عُهد معتمدة بانتظار الصرف', approvedToDisburse, '/treasury')
    push('treasury', 'مصروفات عُهد بانتظار الاعتماد', pendingExpenses, '/treasury')
  }

  // ===== المخزن: أوامر تفريغ بانتظار الاستلام + أصناف تحت الحد =====
  if (has('warehouse')) {
    const [pendingUnloads, lowStock] = await Promise.all([
      prisma.unloadOrder.count({ where: { status: 'PENDING' } }),
      prisma.product.count({ where: { isActive: true, minStock: { gt: 0 }, quantity: { lte: prisma.product.fields.minStock } } }).catch(() => 0),
    ])
    push('warehouse', 'أوامر تفريغ بانتظار استلام المخزن', pendingUnloads, '/warehouse')
    push('warehouse', 'أصناف تحت الحد الأدنى', lowStock, '/warehouse', 'warn')
  }

  // ===== المناديب: أوامر تحميل بانتظار التجهيز/الاستلام =====
  if (has('delegates')) {
    const pendingDeliveries = await prisma.deliveryOrder.count({ where: { status: 'PENDING' } })
    push('delegates', 'أوامر تحميل بانتظار التجهيز/الاستلام', pendingDeliveries, '/delegates')
  }

  // ===== المشتريات: أوامر شراء غير مدفوعة/جزئية =====
  if (has('purchases')) {
    const unpaid = await prisma.purchase.count({ where: { paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } } })
    push('purchases', 'أوامر شراء غير مسدّدة بالكامل', unpaid, '/purchases', 'warn')
  }

  // ===== الموقع الإلكتروني: طلبات أونلاين جديدة =====
  if (has('store')) {
    const newOrders = await prisma.onlineOrder.count({ where: { status: 'PENDING' } })
    push('store', 'طلبات أونلاين جديدة', newOrders, '/online-orders')
  }

  const total = groups.reduce((s, g) => s + g.count, 0)
  return NextResponse.json({ total, groups })
}
