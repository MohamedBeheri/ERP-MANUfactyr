import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'

export async function GET() {
  const auth = await requirePermission('governance', 'view')
  if ('response' in auth) return auth.response

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, username: true, role: true, permissions: true, status: true, lastLogin: true, createdAt: true,
        phone: true, email: true, jobTitle: true, nationalId: true, address: true, hireDate: true, avatarUrl: true, notes: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(users)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('governance', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const { name, username, password, role, permissions } = b

    if (!name?.trim() || !username?.trim() || !password || password.length < 6) {
      return NextResponse.json({ error: 'الاسم واسم المستخدم مطلوبين، وكلمة السر 6 حروف على الأقل' }, { status: 400 })
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

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: hashed,
        role: role || 'SALES',
        permissions: Array.isArray(permissions) ? permissions : [],
        phone: b.phone?.trim() || null,
        email: b.email?.trim() || null,
        jobTitle: b.jobTitle?.trim() || null,
        nationalId: b.nationalId?.trim() || null,
        address: b.address?.trim() || null,
        hireDate: b.hireDate ? new Date(b.hireDate) : null,
        avatarUrl: b.avatarUrl || null,
        notes: b.notes?.trim() || null,
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
    if (e?.code === 'P2002') return NextResponse.json({ error: 'اسم المستخدم ده موجود بالفعل' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
