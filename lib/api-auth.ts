import { NextResponse } from 'next/server'
import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@prisma/client'
import { effectivePermissions, canDoAction } from '@/lib/permissions'

type AuthSuccess = { session: Session }
type AuthFail = { response: NextResponse }

export async function requireRole(allowedRoles: Role[]): Promise<AuthSuccess | AuthFail> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!allowedRoles.includes(session.user.role as Role)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}

export async function requirePermission(
  section: string,
  action: 'view' | 'add' | 'edit' | 'delete'
): Promise<AuthSuccess | AuthFail> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!canDoAction(perms, section, action)) {
    return { response: NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 }) }
  }
  return { session }
}
