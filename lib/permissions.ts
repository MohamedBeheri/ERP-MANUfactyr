// أقسام النظام — كل قسم بيتحكم فيه checkbox في صلاحيات المستخدم
export const PERMISSIONS = [
  { key: 'factory', label: 'المصنع (تصنيع وأوامر شراء)', path: '/factory' },
  { key: 'catalog', label: 'بنك الأصناف (بن/عطارة/توليفات)', path: '/catalog' },
  { key: 'purchases', label: 'المشتريات وأوامر التوريد', path: '/purchases' },
  { key: 'warehouse', label: 'المخزن والجرد', path: '/warehouse' },
  { key: 'sales', label: 'المبيعات ونقطة البيع', path: '/sales' },
  { key: 'customers', label: 'العملاء والبروفايلات', path: '/customers' },
  { key: 'keyaccounts', label: 'كبار الموردين وبيانات الأسعار', path: '/key-accounts' },
  { key: 'delegates', label: 'إدارة المناديب وجولات التوزيع', path: '/delegates' },
  { key: 'drivers', label: 'شاشة المندوب الشخصية', path: '/drivers' },
  { key: 'treasury', label: 'الخزنة والالتزامات المالية', path: '/treasury' },
  { key: 'finance', label: 'التقارير الشاملة', path: '/finance' },
  { key: 'store', label: 'موقع العميل أونلاين وطلباته', path: '/store-settings' },
  { key: 'governance', label: 'الحوكمة وإدارة المستخدمين', path: '/governance' },
  { key: 'settings', label: 'الإعدادات والبيانات الأساسية', path: '/settings' },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]['key']

// الأفعال داخل كل قسم — الصلاحية المخزّنة بالشكل "key:action" أو "key" (يعني كل الأفعال)
export const ACTIONS = [
  { key: 'view', label: 'عرض' },
  { key: 'add', label: 'إضافة' },
  { key: 'edit', label: 'تعديل' },
  { key: 'delete', label: 'حذف' },
] as const
export type ActionKey = (typeof ACTIONS)[number]['key']

// خريطة المسارات → مفتاح الصلاحية (مسارات متعددة ممكن تتبع نفس الصلاحية)
const PATH_PERMS: { prefix: string; key: string }[] = [
  { prefix: '/factory', key: 'factory' },
  { prefix: '/catalog', key: 'catalog' },
  { prefix: '/purchases', key: 'purchases' },
  { prefix: '/warehouse', key: 'warehouse' },
  { prefix: '/sales', key: 'sales' },
  { prefix: '/customers', key: 'customers' },
  { prefix: '/key-accounts', key: 'keyaccounts' },
  { prefix: '/delegates', key: 'delegates' },
  { prefix: '/drivers', key: 'drivers' },
  { prefix: '/treasury', key: 'treasury' },
  { prefix: '/finance', key: 'finance' },
  { prefix: '/store-settings', key: 'store' },
  { prefix: '/online-orders', key: 'store' },
  { prefix: '/governance', key: 'governance' },
  { prefix: '/settings', key: 'settings' },
]

// الصلاحيات الافتراضية لكل دور (لو المستخدم ملوش صلاحيات مخصصة)
// المندوب/المحاسب صلاحياتهم محدودة (view + add بس)، المصنع/المبيعات كل الأفعال في أقسامهم، الأدمن كل حاجة.
export const ROLE_DEFAULTS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key), // كل الأقسام بكل الأفعال
  FACTORY: ['factory', 'catalog', 'purchases', 'warehouse'],
  WAREHOUSE: ['warehouse', 'purchases'],
  SALES: ['sales', 'customers', 'keyaccounts', 'delegates', 'drivers', 'store'],
  ACCOUNTANT: ['finance', 'treasury', 'customers:view', 'sales:view'],
  DELEGATE: ['drivers'],
}

// الصلاحيات الفعلية — الأدمن دايمًا كل حاجة، وإلا المخصصة، وإلا افتراضيات الدور
export function effectivePermissions(role?: string, permissions?: string[]): string[] {
  if (role === 'ADMIN') return PERMISSIONS.map((p) => p.key)
  if (permissions && permissions.length > 0) return permissions
  return ROLE_DEFAULTS[role || ''] || []
}

// فحص إذن قسم (فتح الشاشة)
export function canAccessPath(path: string, role?: string, permissions?: string[]): boolean {
  const perms = effectivePermissions(role, permissions)
  // المندوب (صلاحية drivers فقط) يقدر يفتح شاشة جولته /delegates/{id} بس مش إدارة الأسطول /delegates
  if (path.startsWith('/delegates/') && perms.includes('drivers')) return true
  const match = PATH_PERMS.find((p) => path.startsWith(p.prefix))
  if (!match) return true // مسارات عامة زي /dashboard
  return hasSectionAccess(perms, match.key)
}

// هل عنده أي صلاحية على القسم (view أو أعلى)
export function hasSectionAccess(perms: string[], sectionKey: string): boolean {
  if (perms.includes(sectionKey)) return true // القسم كامل
  return perms.some((p) => p.startsWith(sectionKey + ':'))
}

// فحص إذن فعل معيّن (view/add/edit/delete) في قسم
export function canDoAction(perms: string[], sectionKey: string, action: string): boolean {
  if (perms.includes(sectionKey)) return true // القسم كامل = كل الأفعال
  return perms.includes(`${sectionKey}:${action}`)
}
