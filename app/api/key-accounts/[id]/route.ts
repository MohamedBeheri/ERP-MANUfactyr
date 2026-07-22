import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    const account = await prisma.keyAccount.update({
      where: { id: params.id },
      data: {
        name: b.name?.trim() || undefined,
        brandName: b.brandName !== undefined ? b.brandName?.trim() || null : undefined,
        activityType: b.activityType !== undefined ? b.activityType?.trim() || null : undefined,
        phone: b.phone !== undefined ? b.phone?.trim() || null : undefined,
        address: b.address !== undefined ? b.address?.trim() || null : undefined,
        notes: b.notes !== undefined ? b.notes?.trim() || null : undefined,
      },
    })
    return NextResponse.json(account)
  } catch {
    return NextResponse.json({ error: 'فشل تعديل العميل' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    const acc = await prisma.keyAccount.findUnique({ where: { id: params.id } })
    if (acc && Number(acc.balance) > 0) {
      return NextResponse.json(
        { error: `على العميل مطالبات ${Number(acc.balance).toFixed(2)} ج.م — حصّلها الأول` },
        { status: 400 }
      )
    }
    await prisma.keyAccount.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف العميل' }, { status: 500 })
  }
}
