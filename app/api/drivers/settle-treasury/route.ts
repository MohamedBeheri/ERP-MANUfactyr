import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { salesmanTreasury } from '@/lib/treasuries'
import { parseNum } from '@/lib/numbers'

// تسوية خزنة المندوب مع الخزنة العمومية — سند واحد بكل الكاش (بيع + تحصيل)
// أمين الخزنة العمومية بيعتمده وقتها بيتخصم من خزنة المندوب ويتضاف للعمومية
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
  const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true } })
  if (!delegate) return NextResponse.json({ error: 'الحساب ده مش مربوط بمندوب' }, { status: 403 })

  try {
    const b = await req.json().catch(() => ({}))
    const trId = await salesmanTreasury(prisma, delegate.id)
    const treasury = await prisma.treasury.findUnique({ where: { id: trId } })
    const balance = Number(treasury?.balance || 0)
    // المبلغ: كل الرصيد افتراضيًا (يقدر يسلّم جزء)
    const amount = b.amount ? Number(parseNum(String(b.amount))) : balance
    if (amount <= 0) return NextResponse.json({ error: 'مفيش رصيد في خزنتك للتسوية' }, { status: 400 })
    if (amount > balance) return NextResponse.json({ error: `المبلغ أكبر من رصيد خزنتك (${balance.toLocaleString('ar-EG')} ج.م)` }, { status: 400 })

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.treasurySettlement.count({ where: { settlementNo: { startsWith: `TRS-${today}` } } })
    const settlementNo = `TRS-${today}-${String(count + 1).padStart(3, '0')}`

    const settlement = await prisma.treasurySettlement.create({
      data: {
        settlementNo,
        delegateId: delegate.id,
        amount,
        cashOnlyAmount: amount, // خزنة المندوب كلها كاش (الإلكتروني راح للحسابات الوسيطة وقت البيع/التحصيل)
        method: 'CASH',
        notes: (b.notes || '').trim() || `تسوية خزنة المندوب ${delegate.name} — بيع + تحصيل`,
        status: 'PENDING',
        createdById: session.user.id,
      },
    })
    return NextResponse.json({ success: true, settlementNo: settlement.settlementNo }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تقديم التسوية' }, { status: 500 })
  }
}
