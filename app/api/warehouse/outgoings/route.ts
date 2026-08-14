import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock, getStock, getDefaultWarehouseId } from '@/lib/warehouse'
import { normalizeDigits } from '@/lib/numbers'

// خوارج الشركة (استهلاك داخلي: بوفيه/موظفين) — خصم مخزون + مصروف بالتكلفة (بدون أثر على الخزنة)
export async function GET(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'view')
  if ('response' in auth) return auth.response
  const warehouseId = req.nextUrl.searchParams.get('warehouseId')
  const outgoings = await prisma.warehouseOutgoing.findMany({
    where: { ...(warehouseId ? { warehouseId } : {}) },
    include: {
      warehouse: { select: { name: true } },
      creator: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
  return NextResponse.json(outgoings)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const warehouseId: string = b.warehouseId || (await getDefaultWarehouseId())
    const target = (b.target || '').trim()
    if (!target) return NextResponse.json({ error: 'اختار جهة الصرف (بوفيه / موظفين / سبب)' }, { status: 400 })

    const rawItems: any[] = Array.isArray(b.items) ? b.items : []
    const parsed = rawItems
      .map((it) => ({ productId: it.productId, quantity: Number(normalizeDigits(String(it.quantity ?? ''))) || 0 }))
      .filter((it) => it.productId && it.quantity > 0)
    if (parsed.length === 0) return NextResponse.json({ error: 'أضف صنف واحد على الأقل بكمية' }, { status: 400 })

    // تكلفة كل صنف من بنك الأصناف + تحقق الرصيد
    const items: { productId: string; quantity: number; unitCost: number }[] = []
    for (const it of parsed) {
      const p = await prisma.product.findUnique({ where: { id: it.productId }, select: { name: true, costPrice: true } })
      const stock = await getStock(warehouseId, it.productId)
      if (stock < it.quantity) return NextResponse.json({ error: `رصيد "${p?.name || 'الصنف'}" غير كافي في المخزن (متاح ${stock})` }, { status: 400 })
      items.push({ productId: it.productId, quantity: it.quantity, unitCost: Number(p?.costPrice || 0) })
    }
    const totalCost = items.reduce((s, it) => s + it.quantity * it.unitCost, 0)

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.warehouseOutgoing.count({ where: { outNo: { startsWith: `WOG-${today}` } } })
    const outNo = `WOG-${today}-${String(count + 1).padStart(3, '0')}`

    const outgoing = await prisma.$transaction(async (tx) => {
      const created = await tx.warehouseOutgoing.create({
        data: {
          outNo, warehouseId, target, costAmount: totalCost,
          notes: (b.notes || '').trim() || null,
          createdById: session.user.id,
          items: { create: items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitCost: it.unitCost })) },
        },
        include: { items: true },
      })

      for (const it of items) {
        await tx.product.update({ where: { id: it.productId }, data: { quantity: { decrement: it.quantity } } })
        await adjustStock(tx, warehouseId, it.productId, -it.quantity)
        await tx.warehouseOut.create({
          data: {
            productId: it.productId, warehouseId, quantity: it.quantity,
            target: `خوارج: ${target}`, reason: `استهلاك داخلي — ${outNo}`, createdById: session.user.id,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'خوارج الشركة',
          description: `${outNo}: صرف داخلي لـ${target} — ${items.length} صنف`,
          impact: `−مخزون · مصروف استهلاك ${totalCost.toFixed(2)} ج.م بالتكلفة`,
        },
      })
      return created
    })

    return NextResponse.json(outgoing, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تسجيل الخوارج' }, { status: 500 })
  }
}
