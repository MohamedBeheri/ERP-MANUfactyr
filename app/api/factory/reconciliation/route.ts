import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { computeReconciliation } from '@/lib/reconciliation'

const ALLOWED = ['ADMIN', 'FACTORY'] as const

export async function GET(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const sp = req.nextUrl.searchParams
    const now = new Date()
    const from = sp.get('from') ? new Date(sp.get('from')!) : new Date(now.getFullYear(), now.getMonth(), 1)
    const to = sp.get('to') ? new Date(sp.get('to')! + 'T23:59:59') : now
    const channel = sp.get('channel') || undefined
    const data = await computeReconciliation(from, to, channel)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'فشل إنشاء المحضر' }, { status: 500 })
  }
}
