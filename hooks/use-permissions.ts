'use client'

import { useSession } from 'next-auth/react'
import { effectivePermissions, canDoAction, hasSectionAccess } from '@/lib/permissions'

export function usePermissions() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const perms = effectivePermissions(role, (session?.user as any)?.permissions)

  return {
    perms,
    can: (section: string, action: 'view' | 'add' | 'edit' | 'delete') => canDoAction(perms, section, action),
    hasSection: (section: string) => hasSectionAccess(perms, section),
  }
}
