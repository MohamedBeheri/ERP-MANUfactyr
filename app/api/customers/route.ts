import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { normalizeDigits } from '@/lib/numbers'


export async function GET() {
  const auth = await requirePermission('customers', 'add')
  if ('response' in auth) return auth.response

  try {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(customers)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('customers', 'add')
  if ('response' in auth) return auth.response

  try {
    const body = await req.json()
    const { name, phone, address, area, governorate, lat, lng, activityType, type, customerType, creditLimit, tierId } = body

    if (!name) {
      return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 })
    }

    // التليفون إجباري ولازم يكون 11 رقم (بنقبل الأرقام العربية ونوحّدها)
    const cleanPhone = phone ? normalizeDigits(String(phone)).trim() : ''
    if (!/^\d{11}$/.test(cleanPhone)) {
      return NextResponse.json({ error: 'رقم التليفون مطلوب ولازم يكون 11 رقم' }, { status: 400 })
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone: cleanPhone,
        address: address || null,
        area: area || null,
        governorate: governorate || null,
        lat: typeof lat === 'number' ? lat : null,
        lng: typeof lng === 'number' ? lng : null,
        activityType: activityType || null,
        tierId: tierId || null,
        type: type || 'CASH',
        customerType: customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        creditLimit: creditLimit || 0,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
