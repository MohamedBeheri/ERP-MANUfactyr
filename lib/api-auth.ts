import { NextResponse } from 'next/server'
import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { effectivePermissions, canDoAction } from '@/lib/permissions'

type AuthSuccess = { session: Session }
type AuthFail = { response: NextResponse }

// جلسات JWT ممكن تشاور على مستخدم اتمسح من قاعدة البيانات (زي ما حصل لما القاعدة اتغيرت) —
// أي عملية كتابة ساعتها بتضرب Foreign key error غامض، فبنتحقق هنا ونرد برسالة واضحة
async function sessionUserExists(session: Session): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  })
  return !!user && user.status === 'ACTIVE'
}

const STALE_SESSION = () =>
  NextResponse.json({ error: 'الجلسة دي قديمة أو الحساب اتعطل — سجّل خروج وادخل تاني' }, { status: 401 })

export async function requireRole(allowedRoles: Role[]): Promise<AuthSuccess | AuthFail> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!(await sessionUserExists(session))) {
    return { response: STALE_SESSION() }
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
  if (!(await sessionUserExists(session))) {
    return { response: STALE_SESSION() }
  }
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  if (!canDoAction(perms, section, action)) {
    return { response: NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 }) }
  }
  return { session }
}
