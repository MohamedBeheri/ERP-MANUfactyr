import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

// تغيير حالة البيان (اعتماد/إلغاء)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    await prisma.priceQuote.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'فشل حذف البيان' }, { status: 500 })
  }
}
