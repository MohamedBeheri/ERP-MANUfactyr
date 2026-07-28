import { prisma } from './prisma'

const DEFAULT_CATEGORIES = [
  // أنشطة تشغيلية — تدخل P&L
  { name: 'رواتب وأجور', code: 'SAL', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 1 },
  { name: 'إيجار', code: 'RENT', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 2 },
  { name: 'كهرباء ومياه', code: 'UTIL', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 3 },
  { name: 'صيانة ونظافة', code: 'MAINT', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 4 },
  { name: 'وقود ومواصلات', code: 'FUEL', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 5 },
  { name: 'مستلزمات تشغيل', code: 'SUPP', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 6 },
  { name: 'تسويق وإعلان', code: 'MKT', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 7 },
  { name: 'ضيافة', code: 'HOSP', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 8 },
  { name: 'اتصالات وإنترنت', code: 'COMM', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 9 },
  { name: 'مصاريف إدارية', code: 'ADMIN', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 10 },
  { name: 'مصاريف متنوعة', code: 'MISC', activity: 'OPERATING' as const, affectsPL: true, sortOrder: 11 },
  // أنشطة استثمارية — لا تدخل P&L
  { name: 'شراء أصول ثابتة', code: 'ASSET', activity: 'INVESTING' as const, affectsPL: false, sortOrder: 20 },
  { name: 'أقساط تأمين', code: 'INS', activity: 'INVESTING' as const, affectsPL: false, sortOrder: 21 },
  { name: 'أقساط عقارات', code: 'REAL', activity: 'INVESTING' as const, affectsPL: false, sortOrder: 22 },
  // أنشطة تمويلية — لا تدخل P&L
  { name: 'سداد قروض', code: 'LOAN', activity: 'FINANCING' as const, affectsPL: false, sortOrder: 30 },
  { name: 'أقساط تمويل', code: 'FIN', activity: 'FINANCING' as const, affectsPL: false, sortOrder: 31 },
  { name: 'فوائد بنكية', code: 'INT', activity: 'FINANCING' as const, affectsPL: true, sortOrder: 32 },
]

export async function ensureExpenseCategories() {
  const count = await prisma.expenseCategory.count()
  if (count > 0) return
  await prisma.expenseCategory.createMany({ data: DEFAULT_CATEGORIES })
}
