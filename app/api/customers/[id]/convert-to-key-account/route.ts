import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


// تحويل عميل عادي إلى Key Account (كبار الموردين) — ينقل رصيده ويعطّل حسابه القديم
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('customers', 'edit')
  if ('response' in auth) return auth.response

  try {
    const customer = await prisma.customer.findUnique({ where: { id: params.id } })
    if (!customer) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })

    const b = await req.json().catch(() => ({}))

    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.keyAccount.create({
        data: {
          name: customer.name,
          brandName: b.brandName?.trim() || null,
          activityType: b.activityType?.trim() || null,
          phone: customer.phone,
          address: customer.address,
          balance: customer.balance,
          totalPurchases: customer.totalPurchases,
          notes: `محوّل من عميل عادي بتاريخ التحويل`,
        },
      })
      await tx.customer.update({ where: { id: params.id }, data: { isActive: false } })
      return created
    })

    return NextResponse.json(account, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل التحويل' }, { status: 500 })
  }
}
