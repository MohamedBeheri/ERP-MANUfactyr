import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock, getStock, getDefaultWarehouseId } from '@/lib/warehouse'
import { warehouseTreasury, applyTreasuryTxn } from '@/lib/treasuries'
import { normalizeDigits } from '@/lib/numbers'

// بيع نقدي مباشر من المخزن (لعميل أو تاجر) — الكاش بيدخل خزنة المخزن ويتسوّى مع العمومية زي المندوب
export async function GET(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'view')
  if ('response' in auth) return auth.response
  const warehouseId = req.nextUrl.searchParams.get('warehouseId')
  const sales = await prisma.warehouseSale.findMany({
    where: { ...(warehouseId ? { warehouseId } : {}) },
    include: {
      warehouse: { select: { name: true } },
      creator: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
  return NextResponse.json(sales)
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const warehouseId: string = b.warehouseId || (await getDefaultWarehouseId())
    const buyerType = b.buyerType === 'TRADER' ? 'TRADER' : 'CUSTOMER'
    const buyerName = (b.buyerName || '').trim() || null
    const paymentMethod = (b.paymentMethod || 'نقدي').trim() || 'نقدي'
    const rawItems: any[] = Array.isArray(b.items) ? b.items : []

    const items = rawItems
      .map((it) => ({
        productId: it.productId,
        quantity: Number(normalizeDigits(String(it.quantity ?? ''))) || 0,
        unitPrice: Number(normalizeDigits(String(it.unitPrice ?? ''))) || 0,
      }))
      .filter((it) => it.productId && it.quantity > 0)

    if (items.length === 0) return NextResponse.json({ error: 'أضف صنف واحد على الأقل بكمية وسعر' }, { status: 400 })

    // تحقق الرصيد في المخزن المختار قبل ما نبدأ
    for (const it of items) {
      const stock = await getStock(warehouseId, it.productId)
      if (stock < it.quantity) {
        const p = await prisma.product.findUnique({ where: { id: it.productId }, select: { name: true } })
        return NextResponse.json({ error: `رصيد "${p?.name || 'الصنف'}" غير كافي في المخزن (متاح ${stock})` }, { status: 400 })
      }
    }

    const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.warehouseSale.count({ where: { saleNo: { startsWith: `WSL-${today}` } } })
    const saleNo = `WSL-${today}-${String(count + 1).padStart(3, '0')}`

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.warehouseSale.create({
        data: {
          saleNo,
          warehouseId,
          buyerType,
          buyerName,
          totalAmount: total,
          paymentMethod,
          notes: (b.notes || '').trim() || null,
          createdById: session.user.id,
          items: { create: items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice })) },
        },
        include: { items: true },
      })

      // خصم المخزون + إذن صرف لكل صنف
      for (const it of items) {
        await tx.product.update({ where: { id: it.productId }, data: { quantity: { decrement: it.quantity } } })
        await adjustStock(tx, warehouseId, it.productId, -it.quantity)
        await tx.warehouseOut.create({
          data: {
            productId: it.productId, warehouseId, quantity: it.quantity,
            target: buyerType === 'TRADER' ? `تاجر${buyerName ? `: ${buyerName}` : ''}` : `عميل${buyerName ? `: ${buyerName}` : ''}`,
            reason: `بيع نقدي — ${saleNo}`, createdById: session.user.id,
          },
        })
      }

      // الكاش يدخل خزنة المخزن
      const trId = await warehouseTreasury(tx, warehouseId)
      await applyTreasuryTxn(tx, {
        treasuryId: trId, type: 'IN', amount: total,
        refType: 'warehouse-sale', reference: saleNo,
        description: `بيع نقدي ${saleNo}${buyerName ? ` — ${buyerName}` : ''}`,
        createdById: session.user.id,
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'بيع نقدي من المخزن',
          description: `${saleNo}: بيع ${buyerType === 'TRADER' ? 'تاجر' : 'عميل'}${buyerName ? ` (${buyerName})` : ''} — ${items.length} صنف`,
          impact: `+${total.toFixed(2)} ج.م خزنة المخزن · خصم مخزون`,
        },
      })
      return created
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تسجيل البيع' }, { status: 500 })
  }
}
