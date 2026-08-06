import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { getDefaultWarehouseId, adjustStock, getStock } from '@/lib/warehouse'
import { parseNum } from '@/lib/numbers'

// طلبية إرسال مستقلة لكبار الموردين: توريد بالكمية لفرع واحد أو عدة فروع في طلبية واحدة.
// البضاعة بتتخصم مباشرة من المخزن وقت الإرسال (مش مرتبطة بجولة مندوب)،
// والمطالبة بتتجمّع على المقر الرئيسي زي المعتاد.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('keyaccounts', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const b = await req.json()
    const { keyAccountId, discountType, notes } = b
    const discountPercent = parseNum(b.discountPercent)
    const warehouseId = b.warehouseId || (await getDefaultWarehouseId())

    const lines: { branchId: string; productId: string; quantity: number; unitPrice: number }[] = (b.lines || [])
      .map((l: any) => ({
        branchId: l.branchId,
        productId: l.productId,
        quantity: parseNum(l.quantity),
        unitPrice: parseNum(l.unitPrice),
      }))
      .filter((l: any) => l.branchId && l.productId && l.quantity > 0 && l.unitPrice >= 0)

    if (!keyAccountId || lines.length === 0) {
      return NextResponse.json({ error: 'اختار العميل وسطر توريد واحد على الأقل (فرع + صنف + كمية)' }, { status: 400 })
    }

    const account = await prisma.keyAccount.findUnique({
      where: { id: keyAccountId },
      include: { branches: { where: { isActive: true } } },
    })
    if (!account) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })

    const branchIds = new Set(account.branches.map((br) => br.id))
    for (const l of lines) {
      if (!branchIds.has(l.branchId)) {
        return NextResponse.json({ error: 'فيه فرع في الطلبية مش تابع للعميل المختار' }, { status: 400 })
      }
    }

    // السعر لازم يمشي بآخر بيان سعر معتمد للعميل (لو فيه بند للصنف ده) — مش السعر اللي اتبعت من الفورم
    const approvedQuote = await prisma.priceQuote.findFirst({
      where: { keyAccountId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    const quotePriceByProduct = new Map((approvedQuote?.items || []).map((it) => [it.productId, Number(it.unitPrice)]))
    for (const l of lines) {
      const quotedPrice = quotePriceByProduct.get(l.productId)
      if (quotedPrice !== undefined) l.unitPrice = quotedPrice
    }

    // التحقق من الحد الأدنى للسعر + رصيد المخزن الإجمالي لكل صنف عبر كل الفروع
    const neededByProduct = new Map<string, number>()
    for (const l of lines) {
      neededByProduct.set(l.productId, (neededByProduct.get(l.productId) || 0) + l.quantity)
    }
    for (const [productId, needed] of neededByProduct) {
      const p = await prisma.product.findUnique({ where: { id: productId } })
      if (!p) return NextResponse.json({ error: 'صنف غير موجود' }, { status: 400 })
      const stock = await getStock(warehouseId, productId)
      if (stock < needed) {
        return NextResponse.json(
          { error: `رصيد ${p.name} في المخزن غير كافي (المتاح: ${stock} ${p.unit} — المطلوب: ${needed})` },
          { status: 400 }
        )
      }
      const floor = Number(p.minKeyPrice) || 0
      for (const l of lines.filter((x) => x.productId === productId)) {
        if (floor > 0 && l.unitPrice < floor) {
          return NextResponse.json({ error: `سعر ${p.name} أقل من الحد الأدنى لكبار الموردين (${floor} ج.م)` }, { status: 400 })
        }
      }
    }

    const dPercent = discountType === 'CASH' ? discountPercent : 0

    // تجميع السطور حسب الفرع — توريد مستقل برقم لكل فرع في نفس الطلبية
    const byBranch = new Map<string, typeof lines>()
    for (const l of lines) {
      const list = byBranch.get(l.branchId) || []
      list.push(l)
      byBranch.set(l.branchId, list)
    }

    const baseCount = await prisma.keyAccountSupply.count()

    const supplies = await prisma.$transaction(async (tx) => {
      const created: any[] = []
      let seq = 0
      let totalNet = 0

      for (const [branchId, branchLines] of byBranch) {
        const totalAmount = branchLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
        const netAmount = totalAmount - (totalAmount * dPercent) / 100
        totalNet += netAmount
        seq += 1

        const supply = await tx.keyAccountSupply.create({
          data: {
            supplyNo: `SUP-${String(baseCount + seq).padStart(4, '0')}`,
            keyAccountId,
            branchId,
            totalAmount,
            discountType: dPercent > 0 ? 'CASH' : 'NONE',
            discountPercent: dPercent,
            netAmount,
            notes: notes?.trim() || null,
            createdById: session.user.id,
            items: {
              create: branchLines.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                totalPrice: l.quantity * l.unitPrice,
              })),
            },
          },
          include: { items: { include: { product: true } }, branch: true, keyAccount: true },
        })
        created.push(supply)

        // خصم البضاعة من المخزن + إذن صرف لكل صنف
        for (const l of branchLines) {
          await tx.product.update({
            where: { id: l.productId },
            data: { quantity: { decrement: l.quantity } },
          })
          await adjustStock(tx, warehouseId, l.productId, -l.quantity)
          await tx.warehouseOut.create({
            data: {
              productId: l.productId,
              warehouseId,
              quantity: l.quantity,
              target: `كبار موردين: ${account.name} — فرع ${supply.branch.name}`,
              reason: `طلبية إرسال ${supply.supplyNo}`,
              createdById: session.user.id,
            },
          })
        }
      }

      // المطالبة الإجمالية تتجمّع على المقر الرئيسي
      await tx.keyAccount.update({
        where: { id: keyAccountId },
        data: { balance: { increment: totalNet }, totalPurchases: { increment: totalNet } },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'طلبية إرسال',
          description: `طلبية إرسال لـ ${account.name} — ${byBranch.size} فرع (${created.map((s) => s.supplyNo).join('، ')})`,
          impact: `مطالبة +${totalNet.toFixed(2)} ج.م على المقر`,
        },
      })

      return created
    })

    return NextResponse.json({ supplies }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تسجيل طلبية الإرسال' }, { status: 500 })
  }
}
