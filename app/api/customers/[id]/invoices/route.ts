import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction } from '@/lib/permissions'


// فواتير عميل معيّن (لاختيار الفاتورة اللي بيترجّع منها) — بالبنود لكل سطر + المرتجع قبل كده + بيانات العرض
// متاحة لصاحب صلاحية العملاء، أو للمندوب على عملائه هو (عشان شاشة المرتجعات)
export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
  const params = await rawParams;

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!canDoAction(perms, 'customers', 'view')) {
    // مندوب: يُسمح له بس لو العميل ده مسنود ليه (مباشر أو عن طريق خط سيره)
    const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true }, select: { id: true } })
    const owns = delegate
      ? await prisma.customer.findFirst({ where: { id: params.id, OR: [{ delegateId: delegate.id }, { salesRoute: { delegateId: delegate.id } }] }, select: { id: true } })
      : null
    if (!owns) return NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 })
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: { customerId: params.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        items: { include: { product: true, rewardRule: true, returnItems: true } },
      },
    })

    const data = invoices.map((inv) => ({
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      net: Number(inv.netAmount),
      createdAt: inv.createdAt,
      hasBonus: inv.items.some((it) => it.isBonus),
      items: inv.items.map((it) => ({
        invoiceItemId: it.id,
        productId: it.productId,
        name: it.product.name,
        unit: it.product.unit,
        isBonus: it.isBonus,
        unitPrice: Number(it.unitPrice),
        sold: it.quantity,
        returned: it.returnItems.reduce((s, r) => s + Number(r.quantity), 0),
        rewardRuleId: it.rewardRuleId,
        rule: it.rewardRule
          ? { qualifyingProductId: it.rewardRule.productId, buyQuantity: it.rewardRule.buyQuantity, freeQuantity: it.rewardRule.freeQuantity, repeat: it.rewardRule.repeat }
          : null,
      })),
    }))

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'فشل تحميل فواتير العميل' }, { status: 500 })
  }
}
