// أقسام النظام — كل قسم بيتحكم فيه checkbox في صلاحيات المستخدم
export const PERMISSIONS = [
  { key: 'factory', label: 'المصنع (تصنيع وأوامر شراء)', path: '/factory' },
  { key: 'warehouse', label: 'المخزن والجرد', path: '/warehouse' },
  { key: 'sales', label: 'المبيعات ونقطة البيع', path: '/sales' },
  { key: 'delegates', label: 'المندوبين وجولات التوزيع', path: '/delegates' },
  { key: 'drivers', label: 'شاشة السائقين (الحمولة والمرتجعات)', path: '/drivers' },
  { key: 'finance', label: 'التقارير الشاملة', path: '/finance' },
  { key: 'governance', label: 'الحوكمة وإدارة المستخدمين', path: '/governance' },
  { key: 'settings', label: 'الإعدادات والبيانات الأساسية', path: '/settings' },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]['key']

// الصلاحيات الافتراضية لكل دور (لو المستخدم ملوش صلاحيات مخصصة)
export const ROLE_DEFAULTS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key),
  FACTORY: ['factory', 'warehouse'],
  WAREHOUSE: ['warehouse'],
  SALES: ['sales', 'delegates', 'drivers'],
  ACCOUNTANT: ['finance'],
  DELEGATE: ['drivers'],
}

// الصلاحيات الفعلية: المخصصة لو موجودة، وإلا افتراضيات الدور — والأدمن دايمًا كل حاجة
export function effectivePermissions(role?: string, permissions?: string[]): string[] {
  if (role === 'ADMIN') return PERMISSIONS.map((p) => p.key)
  if (permissions && permissions.length > 0) return permissions
  return ROLE_DEFAULTS[role || ''] || []
}

export function canAccessPath(path: string, role?: string, permissions?: string[]): boolean {
  const perm = PERMISSIONS.find((p) => path.startsWith(p.path))
  if (!perm) return true // مسارات عامة زي /dashboard
  return effectivePermissions(role, permissions).includes(perm.key)
}
