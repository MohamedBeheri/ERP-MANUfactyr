import { prisma } from '@/lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma

// شجرة حسابات مبسّطة للتسويات المخزنية — بتتعمل تلقائي أول مرة
export const GL = {
  INVENTORY: { code: '1200', name: 'مراقبة المخزون', type: 'INVENTORY_ASSET' as const },
  LOSS: { code: '5900', name: 'تسويات عجز مخزني', type: 'ADJUSTMENT_LOSS' as const },
  GAIN: { code: '4900', name: 'أرباح تسويات المخزون', type: 'ADJUSTMENT_GAIN' as const },
  CUSTODY: { code: '1250', name: 'عهد الموظفين', type: 'CUSTODY' as const },
}

let ensured = false
export async function ensureGLAccounts() {
  if (ensured) return
  for (const a of Object.values(GL)) {
    const found = await prisma.gLAccount.findUnique({ where: { code: a.code } })
    if (!found) await prisma.gLAccount.create({ data: { code: a.code, name: a.name, type: a.type } })
  }
  ensured = true
}

export async function getGLAccounts() {
  await ensureGLAccounts()
  const [inventory, loss, gain, custody] = await Promise.all([
    prisma.gLAccount.findUnique({ where: { code: GL.INVENTORY.code } }),
    prisma.gLAccount.findUnique({ where: { code: GL.LOSS.code } }),
    prisma.gLAccount.findUnique({ where: { code: GL.GAIN.code } }),
    prisma.gLAccount.findUnique({ where: { code: GL.CUSTODY.code } }),
  ])
  return { inventory: inventory!, loss: loss!, gain: gain!, custody: custody! }
}

// رقم مستند تسلسلي يومي
export async function nextDocNo(tx: Tx, prefix: string, model: 'stockAdjustment' | 'journalEntry'): Promise<string> {
  const db = tx as typeof prisma
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const field = model === 'stockAdjustment' ? 'docNo' : 'entryNo'
  const count = model === 'stockAdjustment'
    ? await db.stockAdjustment.count({ where: { docNo: { startsWith: `${prefix}-${today}` } } })
    : await db.journalEntry.count({ where: { entryNo: { startsWith: `${prefix}-${today}` } } })
  return `${prefix}-${today}-${String(count + 1).padStart(3, '0')}`
}
