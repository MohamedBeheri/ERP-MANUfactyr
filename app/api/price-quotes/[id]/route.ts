import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


// تغيير حالة البيان (اعتماد/إلغاء)
export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('keyaccounts', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    const b = await req.json()
    const status = ['DRAFT', 'APPROVED', 'CANCELLED'].includes(b.status) ? b.status : undefined
    const quote = await prisma.priceQuote.update({
      where: { id: params.id },
      data: { status, notes: b.notes !== undefined ? b.notes?.trim() || null : undefined },
    })
    return NextResponse.json(quote)
  } catch {
    return NextResponse.json({ error: 'فشل تحديث البيان' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('keyaccounts', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;

  try {
    await prisma.priceQuote.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف البيان' }, { status: 500 })
  }
}
