import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.keyAccountId || !b.name?.trim()) {
      return NextResponse.json({ error: 'اسم الفرع والعميل مطلوبين' }, { status: 400 })
    }
    const branch = await prisma.keyAccountBranch.create({
      data: {
        keyAccountId: b.keyAccountId,
        name: b.name.trim(),
        address: b.address?.trim() || null,
        phone: b.phone?.trim() || null,
        manager: b.manager?.trim() || null,
      },
    })
    return NextResponse.json(branch, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إضافة الفرع' }, { status: 500 })
  }
}
