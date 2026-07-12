import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const { name, username, password, role, permissions, status } = await req.json()

    if (!name?.trim() || !username?.trim()) {
      return NextResponse.json({ error: 'الاسم واسم المستخدم مطلوبين' }, { status: 400 })
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: 'كلمة السر 6 حروف على الأقل' }, { status: 400 })
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response
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
