import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { warehouseTreasury } from '@/lib/treasuries'
import { normalizeDigits } from '@/lib/numbers'

// تسوية خزنة المخزن مع الخزنة العمومية — بموافقة أمين الخزنة (نفس مسار تسويات المناديب)
export async function GET(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'view')
  if ('response' in auth) return auth.response
  const warehouseId = req.nextUrl.searchParams.get('warehouseId')
  const settlements = await prisma.treasurySettlement.findMany({
    where: { warehouseId: warehouseId || { not: null } },
    include: {
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      acceptedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })
  return NextResponse.json(settlements)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const warehouseId: string = b.warehouseId
    if (!warehouseId) return NextResponse.json({ error: 'اختار المخزن' }, { status: 400 })
    const amount = Number(normalizeDigits(String(b.amount ?? ''))) || 0
    if (amount <= 0) return NextResponse.json({ error: 'اكتب المبلغ المسلَّم' }, { status: 400 })

    // رصيد خزنة المخزن الحالي — مينفعش نسلّم أكتر منه
    const trId = await warehouseTreasury(prisma, warehouseId)
    const treasury = await prisma.treasury.findUnique({ where: { id: trId } })
    const balance = Number(treasury?.balance || 0)
    if (amount > balance) return NextResponse.json({ error: `المبلغ أكبر من رصيد خزنة المخزن (${balance.toFixed(2)} ج.م)` }, { status: 400 })

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.treasurySettlement.count({ where: { settlementNo: { startsWith: `TRS-${today}` } } })
    const settlementNo = `TRS-${today}-${String(count + 1).padStart(3, '0')}`

    const settlement = await prisma.treasurySettlement.create({
      data: {
        settlementNo,
        warehouseId,
        amount,
        cashOnlyAmount: amount,
        method: 'CASH',
        notes: (b.notes || '').trim() || null,
        createdById: session.user.id,
      },
      include: { warehouse: { select: { name: true } }, createdBy: { select: { name: true } } },
    })
    return NextResponse.json(settlement, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تقديم التسوية' }, { status: 500 })
  }
}
