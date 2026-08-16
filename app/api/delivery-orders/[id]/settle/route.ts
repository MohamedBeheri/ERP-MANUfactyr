import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { getDefaultWarehouseId, adjustStock } from '@/lib/warehouse'
import { ensureTreasuries, salesmanTreasury, applyTreasuryTxn, CLEARING_NAME, WALLET_CLEARING_NAME } from '@/lib/treasuries'


// تسوية آخر اليوم: المباع والمحصّل بيتحسبوا تلقائي من الفواتير المرتبطة بالجولة،
// والمستخدم بس بيدخل الكمية المرتجعة الفعلية (جرد) لكل صنف عشان ترجع للمخزن.
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
  const params = await rawParams

  try {
    const body = await req.json()
    const returns: { productId: string; quantity: number }[] = body.returns || []
    const notes = body.notes as string | undefined

    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        invoices: { include: { items: true } },
        keyAccountSupplies: { include: { items: true } },
        returns: { include: { items: true } },
        settlement: true,
        delegate: true,
      },
    })

    if (!deliveryOrder) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 })
    }
    const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
    const isOwner = deliveryOrder.delegate.userId === session.user.id
    if (!canDoAction(perms, 'delegates', 'edit') && !isOwner) {
      return NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 })
    }
    if (deliveryOrder.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'الجولة دي مش شغالة حاليًا (خلصت أو اتلغت)' }, { status: 400 })
    }
    if (deliveryOrder.settlement) {
      return NextResponse.json({ error: 'الجولة دي اتعمللها تسوية قبل كده' }, { status: 400 })
    }

    const deliveredByProduct = new Map<string, number>()
    for (const inv of deliveryOrder.invoices) {
      for (const item of inv.items) {
        deliveredByProduct.set(item.productId, (deliveredByProduct.get(item.productId) || 0) + Number(item.quantity))
      }
    }
    // التوريدات لفروع كبار الموردين بتنزل من العربية زي التسليمات
    for (const sup of deliveryOrder.keyAccountSupplies) {
      for (const item of sup.items) {
        deliveredByProduct.set(item.productId, (deliveredByProduct.get(item.productId) || 0) + Number(item.quantity))
      }
    }

    // المرتجعات اللي رجعت للعربية أثناء الجولة بتزوّد المتبقي القابل للإرجاع للمخزن
    const returnedToVan = new Map<string, number>()
    for (const r of deliveryOrder.returns) {
      for (const item of r.items) {
        returnedToVan.set(item.productId, (returnedToVan.get(item.productId) || 0) + Number(item.quantity))
      }
    }

    for (const ret of returns) {
      const loaded = Number(deliveryOrder.items.find((i) => i.productId === ret.productId)?.quantity || 0)
      const delivered = deliveredByProduct.get(ret.productId) || 0
      const maxReturnable = loaded - delivered + (returnedToVan.get(ret.productId) || 0)
      if (Number(ret.quantity) > maxReturnable) {
        return NextResponse.json(
          { error: `الكمية المرتجعة أكبر من المتبقي على العربية (أقصى حد: ${maxReturnable})` },
          { status: 400 }
        )
      }
    }

    // إجمالي الهدايا اللي اتوزّعت في الجولة (بنود البونص)، والمباع المدفوع = الكل − الهدايا
    const bonusQty = deliveryOrder.invoices
      .flatMap((inv) => inv.items)
      .filter((it) => it.isBonus)
      .reduce((s, it) => s + Number(it.quantity), 0)
    const totalDelivered = Array.from(deliveredByProduct.values()).reduce((s, q) => s + q, 0)
    const soldQty = Math.max(0, totalDelivered - bonusQty)
    const returnedQty = returns.reduce((s, r) => s + Number(r.quantity), 0)
    // النقدي = المدفوع فعليًا (يشمل الجزء المدفوع في البيع الجزئي)، الآجل = المتبقي على العملاء
    const cashAmount = deliveryOrder.invoices.reduce((s, inv) => s + Number(inv.paidAmount), 0)
    // تفصيل المحصّل حسب وسيلة الاستلام المسجّلة على كل فاتورة تسليم
    let instapayAmount = 0
    let walletAmount = 0
    for (const inv of deliveryOrder.invoices) {
      const paid = Number(inv.paidAmount)
      if (paid <= 0) continue
      if (inv.collectionMethod === 'تحويل انستا') instapayAmount += paid
      else if (inv.collectionMethod === 'تحويل محفظة') walletAmount += paid
    }
    const cashOnlyAmount = cashAmount - instapayAmount - walletAmount
    const invoiceCredit = deliveryOrder.invoices.reduce(
      (s, inv) => s + (Number(inv.netAmount) - Number(inv.paidAmount)),
      0
    )
    // توريدات كبار الموردين مطالبات (آجل) على المقر الرئيسي
    const keyAccountCredit = deliveryOrder.keyAccountSupplies.reduce((s, sup) => s + Number(sup.netAmount), 0)
    const creditAmount = invoiceCredit + keyAccountCredit
    const totalSalesValue = cashAmount + creditAmount
    const commission = (totalSalesValue * Number(deliveryOrder.delegate.commissionRate)) / 100

    // التفريغ يرجع لنفس مخزن الجولة اللي اتحمّلت منه العربية (إلا لو اتحدد غيره)
    const warehouseId = body.warehouseId || deliveryOrder.warehouseId || (await getDefaultWarehouseId())

    // المرتجع والبواقي مش بيدخلوا المخزن فورًا — بيتعمل "أمر تفريغ" معلّق
    // والمخزن هو اللي بيأكد الاستلام (زي ما أمر التحميل بيتأكد قبل الخصم)
    const validReturns = returns.filter((ret) => Number(ret.quantity) > 0)
    let unloadNo: string | null = null
    if (validReturns.length > 0) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const unlCount = await prisma.unloadOrder.count({ where: { unloadNo: { startsWith: `UNL-${today}` } } })
      unloadNo = `UNL-${today}-${String(unlCount + 1).padStart(3, '0')}`

      // مرتجعات العملاء أثناء الجولة (رجعت على العربية) — للتمييز عن بواقي البيع
      const customerReturnQty = new Map<string, number>()
      for (const dr of deliveryOrder.returns) {
        for (const it of dr.items) {
          customerReturnQty.set(it.productId, (customerReturnQty.get(it.productId) || 0) + Number(it.quantity))
        }
      }

      // كل صنف ممكن يبقى جزء منه مرتجع عميل فعلي والجزء التاني بواقي بيع عادية —
      // بنفصلهم في بندين منفصلين عشان المخزن يشوف التفصيلة الحقيقية بدل ما يتلخبطوا في بند واحد
      const unloadItems: { productId: string; quantity: number; kind: string }[] = []
      for (const ret of validReturns) {
        const qty = Number(ret.quantity)
        const customerReturn = Math.min(qty, customerReturnQty.get(ret.productId) || 0)
        const leftover = qty - customerReturn
        if (customerReturn > 0) unloadItems.push({ productId: ret.productId, quantity: customerReturn, kind: 'RETURN' })
        if (leftover > 0) unloadItems.push({ productId: ret.productId, quantity: leftover, kind: 'LEFTOVER' })
      }

      await prisma.unloadOrder.create({
        data: {
          unloadNo,
          delegateId: deliveryOrder.delegateId,
          deliveryOrderId: deliveryOrder.id,
          warehouseId,
          status: 'PENDING',
          notes: `تفريغ جولة ${deliveryOrder.orderNo}`,
          createdById: session.user.id,
          items: { create: unloadItems },
        },
      })
    }

    const settlement = await prisma.settlement.create({
      data: {
        delegateId: deliveryOrder.delegateId,
        deliveryOrderId: deliveryOrder.id,
        soldQty,
        bonusQty,
        returnedQty,
        cashAmount,
        cashOnlyAmount,
        instapayAmount,
        walletAmount,
        creditAmount,
        commission,
        notes,
        createdById: session.user.id,
      },
    })

    await prisma.delegate.update({
      where: { id: deliveryOrder.delegateId },
      data: {
        totalSales: { increment: totalSalesValue },
        commissionDue: { increment: commission },
      },
    })

    await prisma.deliveryOrder.update({
      where: { id: deliveryOrder.id },
      data: { status: 'COMPLETED' },
    })

    // ===== التوحيد المحاسبي لخزنة المندوب =====
    // فلوس البيع بتدخل نفس خزنة المندوب زي التحصيلات:
    //  • الكاش الفعلي → خزنة المندوب النقدية (يتسوّى معاها آخر اليوم في سند واحد)
    //  • إنستا/محفظة → الحسابات الوسيطة (إلكتروني بيتطابق مع البنك مباشرة)
    if (cashAmount > 0) {
      await ensureTreasuries()
      if (cashOnlyAmount > 0) {
        const trId = await salesmanTreasury(prisma, deliveryOrder.delegateId)
        await applyTreasuryTxn(prisma, {
          treasuryId: trId, type: 'IN', amount: cashOnlyAmount,
          refType: 'delivery-sale', reference: deliveryOrder.orderNo,
          description: `بيع جولة ${deliveryOrder.orderNo} — كاش`, createdById: session.user.id,
        })
      }
      if (instapayAmount > 0) {
        const cl = await prisma.treasury.findUnique({ where: { name: CLEARING_NAME } })
        if (cl) await applyTreasuryTxn(prisma, { treasuryId: cl.id, type: 'IN', amount: instapayAmount, refType: 'delivery-sale', reference: deliveryOrder.orderNo, description: `بيع جولة ${deliveryOrder.orderNo} — إنستا باي`, createdById: session.user.id })
      }
      if (walletAmount > 0) {
        const wl = await prisma.treasury.findUnique({ where: { name: WALLET_CLEARING_NAME } })
        if (wl) await applyTreasuryTxn(prisma, { treasuryId: wl.id, type: 'IN', amount: walletAmount, refType: 'delivery-sale', reference: deliveryOrder.orderNo, description: `بيع جولة ${deliveryOrder.orderNo} — محفظة`, createdById: session.user.id })
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'تسوية',
        description: `تسوية جولة ${deliveryOrder.orderNo} للمندوب ${deliveryOrder.delegate.name}`,
        impact: `مبيعات ${totalSalesValue} ج.م - عمولة ${commission} ج.م - مرتجع ${returnedQty}${bonusQty > 0 ? ` - هدايا ${bonusQty}` : ''}`,
      },
    })

    return NextResponse.json(settlement, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to settle delivery order' }, { status: 500 })
  }
}
