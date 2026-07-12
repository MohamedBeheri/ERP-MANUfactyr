import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

export async function GET() {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        permissions: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(users)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const { name, username, password, role, permissions } = await req.json()

    if (!name?.trim() || !username?.trim() || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'الاسم واسم المستخدم مطلوبين، وكلمة السر 6 حروف على الأقل' },
        { status: 400 }
      )
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: hashed,
        role: role || 'SALES',
        permissions: Array.isArray(permissions) ? permissions : [],
      },
      select: { id: true, name: true, username: true, role: true, permissions: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'مستخدم جديد',
        description: `إنشاء حساب "${user.name}" (${user.username}) بدور ${user.role}`,
        impact: `${user.permissions.length || 'افتراضية'} صلاحية`,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'اسم المستخدم ده موجود بالفعل' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
