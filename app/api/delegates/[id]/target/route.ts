import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAnyPermission } from '@/lib/api-auth'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { computeDelegateAchievement } from '@/lib/delegate-target'
import { parseNum } from '@/lib/numbers'

function period(req: NextRequest) {
  const now = new Date()
  const year = Number(req.nextUrl.searchParams.get('year')) || now.getFullYear()
  const month = Number(req.nextUrl.searchParams.get('month')) || now.getMonth() + 1
  return { year, month }
}

// تارجت الشهر + الإنجاز المحسوب تلقائيًا — الإدارة أو المندوب نفسه
export async function GET(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const params = await rawParams
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canView = canDoAction(perms, 'delegates', 'view') || canDoAction(perms, 'sales', 'view')
  if (!canView) {
    // المندوب يقدر يشوف تارجته هو بس
    const own = await prisma.delegate.findFirst({ where: { id: params.id, userId: session.user.id } })
    if (!own) return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }
  const { year, month } = period(req)

  const [target, achievement, products] = await Promise.all([
    prisma.delegateTarget.findUnique({
      where: { delegateId_year_month: { delegateId: params.id, year, month } },
      include: { productLines: { include: { product: { select: { name: true, unit: true } } } } },
    }),
    computeDelegateAchievement(params.id, year, month),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true }, orderBy: { name: 'asc' } }),
  ])

  return NextResponse.json({
    year, month,
    target: target
      ? {
          collectedAmountTarget: Number(target.collectedAmountTarget),
          salesVisitsTarget: target.salesVisitsTarget,
          collectionVisitsTarget: target.collectionVisitsTarget,
          notes: target.notes,
          productLines: target.productLines.map((l) => ({ productId: l.productId, name: l.product.name, unit: l.product.unit, requiredQty: Number(l.requiredQty) })),
        }
      : null,
    achievement,
    products,
  })
}

// تعيين/تعديل التارجت — الأدمن (أو مدير المبيعات) فقط
export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPermission(['delegates', 'sales'], 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth
  const params = await rawParams
  const b = await req.json()
  const year = Number(b.year) || new Date().getFullYear()
  const month = Number(b.month) || new Date().getMonth() + 1
  const lines: { productId: string; requiredQty: number }[] = Array.isArray(b.productLines)
    ? b.productLines.map((l: any) => ({ productId: l.productId, requiredQty: parseNum(l.requiredQty) })).filter((l: any) => l.productId && l.requiredQty > 0)
    : []

  try {
    const target = await prisma.$transaction(async (tx) => {
      const t = await tx.delegateTarget.upsert({
        where: { delegateId_year_month: { delegateId: params.id, year, month } },
        create: {
          delegateId: params.id, year, month,
          collectedAmountTarget: parseNum(b.collectedAmountTarget),
          salesVisitsTarget: Math.max(0, Math.round(parseNum(b.salesVisitsTarget))),
          collectionVisitsTarget: Math.max(0, Math.round(parseNum(b.collectionVisitsTarget))),
          notes: b.notes?.trim() || null,
        },
        update: {
          collectedAmountTarget: parseNum(b.collectedAmountTarget),
          salesVisitsTarget: Math.max(0, Math.round(parseNum(b.salesVisitsTarget))),
          collectionVisitsTarget: Math.max(0, Math.round(parseNum(b.collectionVisitsTarget))),
          notes: b.notes?.trim() || null,
        },
      })
      await tx.delegateProductTarget.deleteMany({ where: { targetId: t.id } })
      if (lines.length > 0) {
        await tx.delegateProductTarget.createMany({ data: lines.map((l) => ({ targetId: t.id, productId: l.productId, requiredQty: l.requiredQty })) })
      }
      await tx.auditLog.create({
        data: { userId: session.user.id, action: 'تعيين تارجت مندوب', description: `تارجت شهر ${month}/${year}`, impact: `${lines.length} صنف مستهدف` },
      })
      return t
    })
    return NextResponse.json({ success: true, id: target.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل حفظ التارجت' }, { status: 500 })
  }
}
