// أقسام النظام — كل قسم بيتحكم فيه checkbox في صلاحيات المستخدم
export const PERMISSIONS = [
  { key: 'factory', label: 'المصنع (تصنيع وأوامر شراء)', path: '/factory' },
  { key: 'warehouse', label: 'المخزن والجرد', path: '/warehouse' },
  { key: 'sales', label: 'المبيعات ونقطة البيع', path: '/sales' },
  { key: 'customers', label: 'العملاء والبروفايلات', path: '/customers' },
  { key: 'delegates', label: 'المندوبين وجولات التوزيع', path: '/delegates' },
  { key: 'drivers', label: 'شاشة السائقين (الحمولة والمرتجعات)', path: '/drivers' },
  { key: 'finance', label: 'التقارير الشاملة', path: '/finance' },
  { key: 'store', label: 'موقع العميل أونلاين وطلباته', path: '/store-settings' },
  { key: 'governance', label: 'الحوكمة وإدارة المستخدمين', path: '/governance' },
  { key: 'settings', label: 'الإعدادات والبيانات الأساسية', path: '/settings' },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]['key']

// خريطة المسارات → مفتاح الصلاحية (مسارات متعددة ممكن تتبع نفس الصلاحية)
const PATH_PERMS: { prefix: string; key: string }[] = [
  { prefix: '/factory', key: 'factory' },
  { prefix: '/warehouse', key: 'warehouse' },
  { prefix: '/sales', key: 'sales' },
  { prefix: '/customers', key: 'customers' },
  { prefix: '/delegates', key: 'delegates' },
  { prefix: '/drivers', key: 'drivers' },
  { prefix: '/finance', key: 'finance' },
  { prefix: '/store-settings', key: 'store' },
  { prefix: '/online-orders', key: 'store' },
  { prefix: '/governance', key: 'governance' },
  { prefix: '/settings', key: 'settings' },
]

// الصلاحيات الافتراضية لكل دور (لو المستخدم ملوش صلاحيات مخصصة)
export const ROLE_DEFAULTS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key),
  FACTORY: ['factory', 'warehouse'],
  WAREHOUSE: ['warehouse'],
  SALES: ['sales', 'customers', 'delegates', 'drivers', 'store'],
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
  const match = PATH_PERMS.find((p) => path.startsWith(p.prefix))
  if (!match) return true // مسارات عامة زي /dashboard
  return effectivePermissions(role, permissions).includes(match.key)
}
