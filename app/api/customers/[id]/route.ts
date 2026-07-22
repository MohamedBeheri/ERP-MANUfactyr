import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'SALES'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.name?.trim()) {
      return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 })
    }
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        name: b.name.trim(),
        phone: b.phone !== undefined ? b.phone || null : undefined,
        address: b.address !== undefined ? b.address || null : undefined,
        area: b.area !== undefined ? b.area || null : undefined,
        customerType: b.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        tierId: b.tierId !== undefined ? b.tierId || null : undefined,
        creditLimit: b.creditLimit !== undefined ? Number(b.creditLimit) || 0 : undefined,
      },
    })
    return NextResponse.json(customer)
  } catch {
    return NextResponse.json({ error: 'فشل تعديل العميل' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    const customer = await prisma.customer.findUnique({ where: { id: params.id } })
    if (customer && Number(customer.balance) > 0) {
      return NextResponse.json(
        { error: `العميل عليه مديونية ${Number(customer.balance).toFixed(2)} ج.م — حصّلها الأول` },
        { status: 400 }
      )
    }
    // حذف ناعم للحفاظ على الفواتير المرتبطة
    await prisma.customer.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف العميل' }, { status: 500 })
  }
}
