import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { createPurchaseVoucher } from '@/lib/purchase-vouchers'

// سندات الصرف المسجّلة على فاتورة شراء معينة (تاريخ السداد على فترات)
export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('purchases', 'view')
  if ('response' in auth) return auth.response
  const params = await rawParams

  const vouchers = await prisma.purchaseVoucher.findMany({
    where: { purchaseId: params.id },
    orderBy: { createdAt: 'desc' },
    include: { lines: { include: { paymentMethod: true, treasury: true } }, createdBy: { select: { name: true } } },
  })
  return NextResponse.json(vouchers)
}

// سداد لاحق (جزئي أو كامل) لفاتورة شراء موجودة — بيدعم توزيع المبلغ على أكتر من وسيلة دفع
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('purchases', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth
  const params = await rawParams

  try {
    const body = await req.json()
    const result = await prisma.$transaction(async (tx) => {
      return createPurchaseVoucher(tx, {
        purchaseId: params.id,
        lines: Array.isArray(body.lines) ? body.lines : [],
        notes: body.notes,
        createdById: session.user.id,
      })
    })
    return NextResponse.json(result.voucher, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'فشل إنشاء سند الصرف' }, { status: 400 })
  }
}
