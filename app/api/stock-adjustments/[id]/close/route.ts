import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

// إقفال المستند نهائيًا (POSTED → CLOSED) — للأدمن فقط · بيمنع الارتجاع أو أي تعديل بعده
export async function POST(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'إقفال المستند لمدير النظام فقط' }, { status: 403 })
  }

  try {
    const adj = await prisma.stockAdjustment.findUnique({ where: { id: params.id }, select: { id: true, docNo: true, status: true } })
    if (!adj) return NextResponse.json({ error: 'مستند التسوية غير موجود' }, { status: 404 })
    if (adj.status !== 'POSTED') {
      return NextResponse.json({ error: 'الإقفال بيتم للمستندات المرحّلة (المعتمدة) بس' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockAdjustment.update({ where: { id: adj.id }, data: { status: 'CLOSED' } })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'إقفال مستند تسوية جرد',
          description: `إقفال ${adj.docNo} نهائيًا`,
          impact: 'مينفعش ارتجاع أو تعديل بعد الإقفال',
        },
      })
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل الإقفال' }, { status: 500 })
  }
}
