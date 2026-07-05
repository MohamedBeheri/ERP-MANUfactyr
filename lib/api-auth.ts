import { NextResponse } from 'next/server'
import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@prisma/client'

export async function requireRole(allowedRoles: Role[]): Promise<
  { session: Session } | { response: NextResponse }
> {
  const session = await getServerSession(authOptions)

  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!allowedRoles.includes(session.user.role as Role)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { session }
}
