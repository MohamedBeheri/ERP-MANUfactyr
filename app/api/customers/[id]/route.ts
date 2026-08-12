import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { normalizeDigits } from '@/lib/numbers'


export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('customers', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    const b = await req.json()
    if (!b.name?.trim()) {
      return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 })
    }
    // التليفون اختياري، لكن لو اتكتب لازم يكون 11 رقم (بنقبل الأرقام العربية ونوحّدها)
    const cleanPhone = b.phone !== undefined ? (b.phone ? normalizeDigits(String(b.phone)).trim() : null) : undefined
    if (cleanPhone && !/^\d{11}$/.test(cleanPhone)) {
      return NextResponse.json({ error: 'رقم التليفون لازم يكون 11 رقم' }, { status: 400 })
    }
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        name: b.name.trim(),
        phone: cleanPhone,
        address: b.address !== undefined ? b.address || null : undefined,
        area: b.area !== undefined ? b.area || null : undefined,
        governorate: b.governorate !== undefined ? b.governorate || null : undefined,
        lat: b.lat !== undefined ? (typeof b.lat === 'number' ? b.lat : null) : undefined,
        lng: b.lng !== undefined ? (typeof b.lng === 'number' ? b.lng : null) : undefined,
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

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('customers', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

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
