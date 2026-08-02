import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { ensureTreasuries } from '@/lib/treasuries'

export async function GET() {
  const auth = await requirePermission('treasury', 'view')
  if ('response' in auth) return auth.response

  await ensureTreasuries()
  const methods = await prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json(methods)
}
