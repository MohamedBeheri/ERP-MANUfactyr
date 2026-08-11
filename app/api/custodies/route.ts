import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { parseNum } from '@/lib/numbers'

const CUSTODY_INCLUDE = {
  user: { select: { id: true, name: true, jobTitle: true } },
  creator: { select: { name: true } },
  approvedBy: { select: { name: true } },
  disbursedBy: { select: { name: true } },
  settledBy: { select: { name: true } },
  paymentMethod: { select: { name: true } },
  returnMethod: { select: { name: true } },
  treasury: { select: { name: true } },
  returnTreasury: { select: { name: true } },
  expenses: {
    include: {
      category: { select: { name: true } },
      creator: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const

// GET: كل العُهد (لأصحاب صلاحية الخزنة) أو عُهد المستخدم نفسه (?mine=1)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mine = req.nextUrl.searchParams.get('mine') === '1'
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canManage = canDoAction(perms, 'treasury', 'view')

  if (!mine && !canManage) {
    return NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 })
  }

  try {
    const custodies = await prisma.custody.findMany({
      where: mine ? { userId: session.user.id } : {},
      include: CUSTODY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(custodies)
  } catch {
    return NextResponse.json({ error: 'فشل تحميل العُهد' }, { status: 500 })
  }
}

// POST: طلب عهدة جديد — الموظف لنفسه، أو الأدمن/الخزنة نيابة عن موظف (userId في الـ body)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await req.json()
    const amount = parseNum(b.amount)
    const purpose = String(b.purpose || '').trim()
    if (!(amount > 0) || !purpose) {
      return NextResponse.json({ error: 'اكتب مبلغ العهدة والغرض منها' }, { status: 400 })
    }

    const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
    const canManage = canDoAction(perms, 'treasury', 'add')
    // الموظف العادي يقدر يطلب لنفسه بس — اللي معاه صلاحية خزنة يقدر يسجل لأي موظف
    const userId = canManage && b.userId ? String(b.userId) : session.user.id

    const employee = await prisma.user.findUnique({ where: { id: userId } })
    if (!employee || employee.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'الموظف غير موجود أو حسابه معطّل' }, { status: 400 })
    }

    // حوكمة: ممنوع طلب/عهدة جديدة والموظف لسه عنده عهدة مفتوحة (مش متسوّية ولا مرفوضة)
    const open = await prisma.custody.findFirst({
      where: { userId, status: { in: ['PENDING', 'APPROVED', 'DISBURSED'] } },
    })
    if (open) {
      return NextResponse.json(
        { error: `الموظف عنده عهدة مفتوحة بالفعل (${open.custodyNo}) — لازم تتسوى الأول` },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.custody.count({ where: { custodyNo: { startsWith: `CUS-${today}` } } })
    const custodyNo = `CUS-${today}-${String(count + 1).padStart(3, '0')}`

    const custody = await prisma.custody.create({
      data: {
        custodyNo,
        userId,
        purpose,
        requestedAmount: amount,
        notes: b.notes?.trim() || null,
        createdById: session.user.id,
      },
      include: CUSTODY_INCLUDE,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'طلب عهدة',
        description: `طلب عهدة ${custodyNo} للموظف ${employee.name} — ${purpose}`,
        impact: `${amount.toLocaleString('ar-EG')} ج.م بانتظار الاعتماد`,
      },
    })

    return NextResponse.json(custody, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل تسجيل طلب العهدة' }, { status: 500 })
  }
}
