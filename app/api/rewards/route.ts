import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

// GET: قائمة عروض المكافآت (متاح لمن لهم صلاحية البيع لعرضها أثناء التسليم)
export async function GET() {
  const auth = await requireRole(['ADMIN', 'SALES'])
  if ('response' in auth) return auth.response

  try {
    const rules = await prisma.rewardRule.findMany({
      include: { product: true, freeProduct: true, tier: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(rules)
  } catch {
    return NextResponse.json({ error: 'فشل جلب العروض' }, { status: 500 })
  }
}

// POST: إضافة عرض جديد (أدمن فقط)
export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if ('response' in auth) return auth.response

  try {
    const b = await req.json()
    if (!b.name?.trim() || !b.productId || !b.freeProductId) {
      return NextResponse.json({ error: 'الاسم والصنف والصنف الهدية مطلوبين' }, { status: 400 })
    }
    if (!(Number(b.buyQuantity) > 0) || !(Number(b.freeQuantity) > 0)) {
      return NextResponse.json({ error: 'كمية الشراء والهدية لازم تكون أكبر من صفر' }, { status: 400 })
    }
    const rule = await prisma.rewardRule.create({
      data: {
        name: b.name.trim(),
        productId: b.productId,
        buyQuantity: Number(b.buyQuantity),
        bundleSize: Number(b.bundleSize) || 1,
        freeProductId: b.freeProductId,
        freeQuantity: Number(b.freeQuantity),
        repeat: b.repeat !== false,
        tierId: b.tierId || null,
        isActive: b.isActive !== false,
      },
    })
    return NextResponse.json(rule, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إضافة العرض' }, { status: 500 })
  }
}
