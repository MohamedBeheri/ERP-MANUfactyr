import { prisma } from '@/lib/prisma'

// وحدات القياس الافتراضية — قابلة للتعديل من الأدمن بالكامل بعد أول تشغيل
const DEFAULT_UNITS = [
  { name: 'كجم', sortOrder: 1 },
  { name: 'جرام', sortOrder: 2 },
  { name: 'كيس', sortOrder: 3 },
]

let ensured = false

export async function ensureUnits() {
  if (ensured) return
  const count = await prisma.unit.count()
  if (count === 0) {
    await prisma.unit.createMany({ data: DEFAULT_UNITS })
  }
  ensured = true
}
