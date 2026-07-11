import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'

const ALLOWED_ROLES = ['ADMIN', 'WAREHOUSE'] as const

// جرد المخزن: مقارنة الكمية الفعلية بالمسجلة وتسوية الفرق بإذن إضافة/صرف
export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { items, notes } = body as { items: { productId: string; countedQty: number }[]; notes?: string }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'أدخل كمية فعلية لصنف واحد على الأقل' }, { status: 400 })
    }

    const adjustments: { name: string; diff: number }[] = []

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) continue

        const counted = Math.max(0, Math.floor(item.countedQty))
        const diff = counted - product.quantity
        if (diff === 0) continue

        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: counted },
        })

        if (diff > 0) {
          await tx.warehouseIn.create({
            data: {
              productId: item.productId,
              quantity: diff,
              source: 'تسوية جرد (زيادة)',
              notes,
              createdById: session.user.id,
            },
          })
        } else {
          await tx.warehouseOut.create({
            data: {
              productId: item.productId,
              quantity: -diff,
              target: 'تسوية جرد',
              reason: 'عجز جرد',
              notes,
              createdById: session.user.id,
            },
          })
        }

        adjustments.push({ name: product.name, diff })
      }

      if (adjustments.length > 0) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'جرد مخزن',
            description: `جرد وتسوية ${adjustments.length} صنف: ${adjustments
              .map((a) => `${a.name} (${a.diff > 0 ? '+' : ''}${a.diff})`)
              .join('، ')}`,
            impact: `${adjustments.length} تسوية`,
          },
        })
      }
    })

    return NextResponse.json({ success: true, adjusted: adjustments.length })
  } catch (error) {
    return NextResponse.json({ error: 'فشلت عملية الجرد' }, { status: 500 })
  }
}
