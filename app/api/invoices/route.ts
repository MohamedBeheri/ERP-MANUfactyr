import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, requireAnyPermission } from '@/lib/api-auth'
import { getDefaultWarehouseId, adjustStock, getStock } from '@/lib/warehouse'
import { computeBonuses } from '@/lib/rewards'
import { warehouseTreasury, applyTreasuryTxn, ensureTreasuries, CLEARING_NAME, BANK_NAME } from '@/lib/treasuries'


export async function GET() {
  const auth = await requireAnyPermission(['sales', 'cafe_pos'], 'add')
  if ('response' in auth) return auth.response

  try {
    const invoices = await prisma.invoice.findMany({
      include: { customer: true, point: true, items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invoices)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAnyPermission(['sales', 'cafe_pos'], 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { customerId, items, discount, type, pointId, paymentMethod } = body
    const warehouseId = body.warehouseId || (await getDefaultWarehouseId())
    const cafeSale = !!body.cafeSale
    if (cafeSale) await ensureTreasuries()

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'اختار عميل وأدخل صنف واحد على الأقل' }, { status: 400 })
    }

    // الآجل مسموح لعملاء الجملة فقط
    if (type === 'CREDIT') {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } })
      if (!customer || customer.customerType !== 'WHOLESALE') {
        return NextResponse.json(
          { error: 'البيع الآجل متاح لعملاء الجملة فقط — العميل القطاعي بيدفع فوري' },
          { status: 400 }
        )
      }
    }

    // أصناف الكافيه (مشروبات/ديزرت) بيتحدد رصيدها من توليفة استهلاك الخامات، مش من رصيدها هي مباشرة
    const cafeRecipes = await prisma.cafeRecipeItem.findMany({
      where: { productId: { in: items.map((i: any) => i.productId) } },
      include: { material: { select: { name: true, unit: true } } },
    })
    const cafeRecipeByProduct = new Map<string, typeof cafeRecipes>()
    for (const r of cafeRecipes) {
      const list = cafeRecipeByProduct.get(r.productId) || []
      list.push(r)
      cafeRecipeByProduct.set(r.productId, list)
    }

    // التحقق من رصيد المخزن المختار قبل البيع
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) {
        return NextResponse.json({ error: 'صنف غير موجود' }, { status: 400 })
      }
      const recipe = cafeRecipeByProduct.get(item.productId)
      if (recipe && recipe.length > 0) {
        for (const r of recipe) {
          const matStock = await getStock(warehouseId, r.materialId)
          const needed = Number(r.quantity) * item.quantity
          if (matStock < needed) {
            return NextResponse.json(
              { error: `رصيد ${r.material.name} في المخزن ده غير كافي لتحضير ${product.name} (المتاح: ${matStock} ${r.material.unit})` },
              { status: 400 }
            )
          }
        }
        continue
      }
      const stock = await getStock(warehouseId, item.productId)
      if (stock < item.quantity) {
        return NextResponse.json(
          { error: `رصيد ${product.name} في المخزن ده غير كافي (المتاح: ${stock} ${product.unit})` },
          { status: 400 }
        )
      }
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0)
    const netAmount = totalAmount - (totalAmount * (discount || 0)) / 100

    // ===== مكافآت الكمية (هدايا) =====
    // نحسب الهدية حسب فئة العميل، ونقصّها على المتاح في المخزن بعد الأصناف المدفوعة.
    const buyerForBonus = await prisma.customer.findUnique({ where: { id: customerId } })
    const rawBonuses = await computeBonuses(prisma, buyerForBonus?.tierId ?? null, items)
    const bonusLines: { productId: string; quantity: number; rewardRuleId: string }[] = []
    for (const b of rawBonuses) {
      const stock = await getStock(warehouseId, b.productId)
      const paidSame = items
        .filter((it: any) => it.productId === b.productId)
        .reduce((s: number, it: any) => s + it.quantity, 0)
      const available = stock - paidSame
      const qty = Math.max(0, Math.min(b.quantity, available))
      if (qty > 0) bonusLines.push({ productId: b.productId, quantity: qty, rewardRuleId: b.rewardRuleId })
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNo: `INV-${Date.now()}`,
          customerId,
          totalAmount,
          discount: discount || 0,
          netAmount,
          type,
          paymentMethod: type === 'CREDIT' ? 'آجل' : paymentMethod || 'نقدي',
          pointId,
          createdById: session.user.id,
          items: {
            create: [
              ...items.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
              })),
              ...bonusLines.map((b) => ({
                productId: b.productId,
                quantity: b.quantity,
                unitPrice: 0,
                totalPrice: 0,
                isBonus: true,
                rewardRuleId: b.rewardRuleId,
              })),
            ],
          },
        },
        include: { items: true },
      })

      // صرف الأصناف المدفوعة + الهدايا من المخزن (كلها بتخرج فعليًا)
      const stockMoves = [
        ...items.map((it: any) => ({ productId: it.productId, quantity: it.quantity, bonus: false })),
        ...bonusLines.map((b) => ({ productId: b.productId, quantity: b.quantity, bonus: true })),
      ]
      for (const move of stockMoves) {
        const recipe = cafeRecipeByProduct.get(move.productId)
        if (recipe && recipe.length > 0) {
          // صنف كافيه: بيتحضّر وقت البيع — بنستهلك خاماته بدل ما نخصم رصيده هو
          for (const r of recipe) {
            const needed = Number(r.quantity) * move.quantity
            await adjustStock(tx, warehouseId, r.materialId, -needed)
            await tx.warehouseOut.create({
              data: {
                productId: r.materialId,
                warehouseId,
                quantity: needed,
                target: `استهلاك توليفة - فاتورة ${created.invoiceNo}`,
                reason: 'استهلاك توليفة كافيه',
                createdById: session.user.id,
              },
            })
          }
          continue
        }
        await tx.product.update({
          where: { id: move.productId },
          data: { quantity: { decrement: move.quantity } },
        })
        await adjustStock(tx, warehouseId, move.productId, -move.quantity)
        await tx.warehouseOut.create({
          data: {
            productId: move.productId,
            warehouseId,
            quantity: move.quantity,
            target: `عميل - فاتورة ${created.invoiceNo}`,
            reason: move.bonus ? 'هدية كمية' : 'فاتورة بيع',
            createdById: session.user.id,
          },
        })
      }

      // بونص الفئة: نسبة من صافي الفاتورة تتضاف لرصيد نقاط العميل (1 نقطة = 1 ج.م)
      const buyer = await tx.customer.findUnique({ where: { id: customerId }, include: { tier: true } })
      const bonusEarned = buyer?.tier ? (netAmount * Number(buyer.tier.bonusPercent)) / 100 : 0

      if (type === 'CREDIT') {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: { increment: netAmount },
            totalPurchases: { increment: netAmount },
            ...(bonusEarned > 0 ? { bonusPoints: { increment: bonusEarned } } : {}),
          },
        })
      } else {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalPurchases: { increment: netAmount },
            ...(bonusEarned > 0 ? { bonusPoints: { increment: bonusEarned } } : {}),
          },
        })
      }

      // ===== الحركة المالية للكافيه =====
      // الكاش بيدخل خزنة الكافيه (نفس مخزن الكافيه) ويتسوّى مع العمومية زي المندوب.
      // انستاباي ← حساب تحت التسوية · فيزا ← الحساب البنكي.
      if (cafeSale && type !== 'CREDIT' && netAmount > 0) {
        const m = (paymentMethod || 'نقدي').trim()
        if (m === 'انستاباي') {
          const t = await tx.treasury.findFirst({ where: { name: CLEARING_NAME } })
          if (t) await applyTreasuryTxn(tx, { treasuryId: t.id, type: 'IN', amount: netAmount, refType: 'cafe-sale', reference: created.invoiceNo, description: `بيع كافيه انستاباي ${created.invoiceNo}`, createdById: session.user.id })
        } else if (m === 'فيزا') {
          const t = await tx.treasury.findFirst({ where: { name: BANK_NAME } })
          if (t) await applyTreasuryTxn(tx, { treasuryId: t.id, type: 'IN', amount: netAmount, refType: 'cafe-sale', reference: created.invoiceNo, description: `بيع كافيه فيزا ${created.invoiceNo}`, createdById: session.user.id })
        } else {
          // نقدي / مختلط ← خزنة الكافيه (تتسوّى مع العمومية)
          const trId = await warehouseTreasury(tx, warehouseId)
          await applyTreasuryTxn(tx, { treasuryId: trId, type: 'IN', amount: netAmount, refType: 'cafe-sale', reference: created.invoiceNo, description: `بيع كافيه نقدي ${created.invoiceNo}`, createdById: session.user.id })
        }
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'بيع',
          description: `فاتورة بيع ${created.invoiceNo}`,
          impact: `+${netAmount.toFixed(2)} ج.م${cafeSale ? ' · خزنة الكافيه' : ''}`,
        },
      })

      return created
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
