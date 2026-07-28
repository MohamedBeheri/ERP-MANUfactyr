import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'


export async function GET(req: NextRequest) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response

  const unreadOnly = req.nextUrl.searchParams.get('unread') === '1'
  const limit = Number(req.nextUrl.searchParams.get('limit')) || 50

  const notifications = await prisma.treasuryNotification.findMany({
    where: unreadOnly ? { isRead: false } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json(notifications)
}

// تعليم إشعار كمقروء
export async function PATCH(req: NextRequest) {
  const auth = await requirePermission('treasury', 'edit')
  if ('response' in auth) return auth.response

  const body = await req.json()
  const { id, markAllRead } = body

  if (markAllRead) {
    await prisma.treasuryNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    })
    return NextResponse.json({ ok: true })
  }

  if (id) {
    await prisma.treasuryNotification.update({
      where: { id },
      data: { isRead: true },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'id or markAllRead required' }, { status: 400 })
}
