import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { parseNum } from '@/lib/numbers'

export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('employees', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams;
  const { session } = auth

  try {
    const b = await req.json()
    const { name, username, password, role, permissions, status } = b

    if (!name?.trim() || !username?.trim()) {
      return NextResponse.json({ error: 'الاسم واسم المستخدم مطلوبين' }, { status: 400 })
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: 'كلمة السر 6 حروف على الأقل' }, { status: 400 })
    }
    if (!b.jobTitle?.trim()) {
      return NextResponse.json({ error: 'المسمى الوظيفي مطلوب' }, { status: 400 })
    }
    if (!b.phone?.trim() || !/^\d{11}$/.test(b.phone.trim())) {
      return NextResponse.json({ error: 'رقم التليفون لازم يكون 11 رقم' }, { status: 400 })
    }
    if (!b.nationalId?.trim() || !/^\d{14}$/.test(b.nationalId.trim())) {
      return NextResponse.json({ error: 'الرقم القومي لازم يكون 14 رقم' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
        role: role || undefined,
        permissions: Array.isArray(permissions) ? permissions : undefined,
        status: status || undefined,
        phone: b.phone !== undefined ? b.phone?.trim() || null : undefined,
        email: b.email !== undefined ? b.email?.trim() || null : undefined,
        jobTitle: b.jobTitle !== undefined ? b.jobTitle?.trim() || null : undefined,
        nationalId: b.nationalId !== undefined ? b.nationalId?.trim() || null : undefined,
        address: b.address !== undefined ? b.address?.trim() || null : undefined,
        hireDate: b.hireDate !== undefined ? (b.hireDate ? new Date(b.hireDate) : null) : undefined,
        commissionRate: b.commissionRate !== undefined ? parseNum(b.commissionRate) : undefined,
        monthlyTarget: b.monthlyTarget !== undefined ? parseNum(b.monthlyTarget) : undefined,
        avatarUrl: b.avatarUrl !== undefined ? b.avatarUrl || null : undefined,
        notes: b.notes !== undefined ? b.notes?.trim() || null : undefined,
      },
      select: { id: true, name: true, username: true, role: true, permissions: true, status: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'تعديل مستخدم',
        description: `تعديل حساب "${user.name}" (${user.username})`,
        impact: `دور: ${user.role}`,
      },
    })

    return NextResponse.json(user)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'اسم المستخدم ده موجود بالفعل' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('employees', 'delete')
  if ('response' in auth) return auth.response
  const params = await rawParams;
  const { session } = auth

  try {
    if (params.id === session.user.id) {
      return NextResponse.json({ error: 'مينفعش تحذف حسابك الشخصي' }, { status: 400 })
    }
    // تعطيل بدل الحذف الفعلي للحفاظ على السجلات المرتبطة
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { status: 'INACTIVE' },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'تعطيل مستخدم',
        description: `تعطيل حساب "${user.name}" (${user.username})`,
        impact: 'الحساب مش هيقدر يسجل دخول',
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
