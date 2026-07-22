import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED = ['ADMIN', 'SALES'] as const

export async function GET(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response

  try {
    const accountId = req.nextUrl.searchParams.get('keyAccountId') || undefined
    const quotes = await prisma.priceQuote.findMany({
      where: accountId ? { keyAccountId: accountId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        keyAccount: true,
        creator: true,
        items: { include: { product: true } },
      },
    })
    return NextResponse.json(quotes)
  } catch {
    return NextResponse.json({ error: 'فشل جلب بيانات الأسعار' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const items: { productId: string; quantity?: number; unitPrice: number }[] = b.items || []
    if (!b.keyAccountId) return NextResponse.json({ error: 'اختار العميل' }, { status: 400 })
    const clean = items.filter((i) => i.productId && Number(i.unitPrice) > 0)
    if (clean.length === 0) return NextResponse.json({ error: 'أضف صنف واحد على الأقل بسعر' }, { status: 400 })

    // التحقق من الحد الأدنى: السعر لا يقل عن minKeyPrice المحدد للمنتج
    const productIds = clean.map((i) => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const pMap = new Map(products.map((p) => [p.id, p]))
    for (const it of clean) {
      const p = pMap.get(it.productId)
      if (!p) return NextResponse.json({ error: 'صنف غير موجود' }, { status: 400 })
      const floor = Number(p.minKeyPrice) || 0
      if (floor > 0 && Number(it.unitPrice) < floor) {
        return NextResponse.json(
          { error: `سعر ${p.name} (${it.unitPrice}) أقل من الحد الأدنى لكبار الموردين (${floor} ج.م)` },
          { status: 400 }
        )
      }
    }

    const count = await prisma.priceQuote.count()
    const quote = await prisma.priceQuote.create({
      data: {
        quoteNo: `PQ-${String(count + 1).padStart(4, '0')}`,
        keyAccountId: b.keyAccountId,
        status: 'DRAFT',
        discountType: b.discountType === 'CASH' ? 'CASH' : 'NONE',
        discountPercent: Number(b.discountPercent) || 0,
        adminExpenses: Number(b.adminExpenses) || 0,
        notes: b.notes?.trim() || null,
        validUntil: b.validUntil ? new Date(b.validUntil) : null,
        createdById: session.user.id,
        items: {
          create: clean.map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity) || 0,
            unitPrice: Number(i.unitPrice),
          })),
        },
      },
      include: { items: { include: { product: true } }, keyAccount: true },
    })
    return NextResponse.json(quote, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'فشل إنشاء بيان السعر' }, { status: 500 })
  }
}
