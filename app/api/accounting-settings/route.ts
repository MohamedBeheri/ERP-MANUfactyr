import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

// إعدادات الإقفال المحاسبي — قراءة
export async function GET() {
  const auth = await requirePermission('warehouse', 'view')
  if ('response' in auth) return auth.response
  const s = await prisma.accountingSettings.findFirst()
  return NextResponse.json({ periodLockDate: s?.periodLockDate?.toISOString().slice(0, 10) || null })
}

// تعيين تاريخ إقفال الفترة — الأدمن فقط
export async function PUT(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'إقفال الفترة من صلاحية مدير النظام فقط' }, { status: 403 })
  }
  try {
    const b = await req.json()
    const date = b.periodLockDate ? new Date(b.periodLockDate) : null
    const existing = await prisma.accountingSettings.findFirst()
    const saved = existing
      ? await prisma.accountingSettings.update({ where: { id: existing.id }, data: { periodLockDate: date } })
      : await prisma.accountingSettings.create({ data: { periodLockDate: date } })
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'إقفال فترة محاسبية',
        description: date ? `إقفال حتى ${date.toLocaleDateString('ar-EG')}` : 'إلغاء الإقفال',
        impact: 'يمنع ترحيل تسويات الجرد داخل الفترة المقفولة',
      },
    })
    return NextResponse.json({ periodLockDate: saved.periodLockDate?.toISOString().slice(0, 10) || null })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل حفظ الإقفال' }, { status: 500 })
  }
}
