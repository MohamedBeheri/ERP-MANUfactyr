import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES', 'DELEGATE'] as const

// فواتير عميل معيّن (لاختيار الفاتورة اللي بيترجّع منها) — بالبنود لكل سطر + المرتجع قبل كده + بيانات العرض
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

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
        returned: it.returnItems.reduce((s, r) => s + r.quantity, 0),
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
