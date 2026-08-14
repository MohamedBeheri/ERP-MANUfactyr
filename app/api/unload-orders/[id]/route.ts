import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock, getDefaultWarehouseId } from '@/lib/warehouse'

// تأكيد/رفض استلام تفريغ العربية — أمين المخزن هو اللي بيدخّل البضاعة فعليًا
export async function PATCH(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth

  const body = await req.json()
  const { action, notes } = body
  const unload = await prisma.unloadOrder.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { product: true } },
      delegate: { include: { vehicle: true } },
      deliveryOrder: { select: { orderNo: true } },
    },
  })
  if (!unload) return NextResponse.json({ error: 'أمر التفريغ غير موجود' }, { status: 404 })
  if (unload.status !== 'PENDING') {
    return NextResponse.json({ error: 'الأمر ده اتأكد أو اتلغى قبل كده' }, { status: 400 })
  }

  if (action === 'confirm') {
    const warehouseId = unload.warehouseId || (await getDefaultWarehouseId())
    const vanLabel = unload.delegate.vehicle?.plateNo || unload.delegate.carNumber || ''

    // استلام بعجز: المخزن بيدخّل الكميات المستلمة فعلاً لكل صنف · العجز = المُعلَن − المستلَم
    // received = [{ itemId, receivedQty }] — لو مش موجود يبقى استلام مطابق (الكل)
    const receivedMap = new Map<string, number>()
    if (Array.isArray(body.received)) {
      for (const r of body.received) {
        if (r?.itemId != null) receivedMap.set(String(r.itemId), Math.max(0, Number(r.receivedQty) || 0))
      }
    }

    // حساب العجز وقيمته بسعر البيع
    const productIds = unload.items.map((i) => i.productId)
    const prods = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sellPrice: true } })
    const priceOf = new Map(prods.map((p) => [p.id, Number(p.sellPrice)]))
    let shortageValue = 0
    const shortageLines: { name: string; qty: number; value: number }[] = []
    const plan = unload.items.map((it) => {
      const declared = Number(it.quantity)
      const received = receivedMap.has(it.id) ? Math.min(declared, receivedMap.get(it.id)!) : declared
      const shortage = Math.max(0, declared - received)
      if (shortage > 0) {
        const val = shortage * (priceOf.get(it.productId) || 0)
        shortageValue += val
        const pname = prods.find((p) => p.id === it.productId)?.name || 'صنف'
        shortageLines.push({ name: pname, qty: shortage, value: val })
      }
      return { it, declared, received, shortage }
    })
    shortageValue = Math.round(shortageValue * 100) / 100

    await prisma.$transaction(async (tx) => {
      for (const { it, received } of plan) {
        if (received > 0) {
          await tx.product.update({ where: { id: it.productId }, data: { quantity: { increment: received } } })
          await adjustStock(tx, warehouseId, it.productId, received)
          await tx.warehouseIn.create({
            data: {
              productId: it.productId,
              warehouseId,
              quantity: received,
              source: `تفريغ عربية - أمر ${unload.unloadNo} (مندوب: ${unload.delegate.name}${vanLabel ? ` — عربية ${vanLabel}` : ''}) · ${it.kind === 'RETURN' ? 'مرتجع عميل' : 'بواقي بيع'}`,
              createdById: session.user.id,
            },
          })
        }
        // نسجّل الكمية المستلمة فعلاً على البند (لو فيه عجز)
        if (receivedMap.has(it.id)) {
          await tx.unloadItem.update({ where: { id: it.id }, data: { receivedQty: received } })
        }
      }

      const memoNote = shortageLines.length
        ? `مذكرة عجز: ${shortageLines.map((l) => `${l.name} ناقص ${l.qty.toLocaleString('ar-EG')} (${l.value.toLocaleString('ar-EG')} ج.م)`).join(' · ')}`
        : ''
      await tx.unloadOrder.update({
        where: { id: unload.id },
        data: {
          status: 'CONFIRMED',
          shortageValue,
          confirmedById: session.user.id,
          confirmedAt: new Date(),
          notes: [
            unload.notes,
            notes && String(notes).trim() ? `ملاحظة المخزن: ${String(notes).trim()}` : '',
            memoNote,
          ].filter(Boolean).join('\n') || unload.notes,
        },
      })

      // عجز → فاتورة على المندوب: بتتحمّل على مديونيته + مذكرة ترفع للخزينة
      if (shortageValue > 0) {
        await tx.delegate.update({ where: { id: unload.delegateId }, data: { shortageDebt: { increment: shortageValue } } })
        await tx.treasuryNotification.create({
          data: {
            type: 'SHORTAGE_MEMO',
            title: `مذكرة عجز تفريغ — ${unload.delegate.name}`,
            message: `عجز بقيمة ${shortageValue.toLocaleString('ar-EG')} ج.م على أمر التفريغ ${unload.unloadNo}${unload.deliveryOrder ? ` (جولة ${unload.deliveryOrder.orderNo})` : ''} — اتحمّل على المندوب. ${memoNote}`,
            refId: unload.id,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: shortageValue > 0 ? 'استلام تفريغ بعجز' : 'تأكيد تفريغ',
          description: `استلام تفريغ العربية - أمر ${unload.unloadNo} (${unload.delegate.name}${unload.deliveryOrder ? ` — جولة ${unload.deliveryOrder.orderNo}` : ''})`,
          impact: `+${plan.reduce((s, p) => s + p.received, 0)} للمخزن${shortageValue > 0 ? ` · عجز ${shortageValue.toLocaleString('ar-EG')} ج.م على المندوب` : ''}`,
        },
      })
    })

    return NextResponse.json({ success: true, shortageValue })
  }

  if (action === 'cancel') {
    await prisma.unloadOrder.update({
      where: { id: unload.id },
      data: { status: 'CANCELLED', confirmedById: session.user.id, confirmedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'action must be confirm or cancel' }, { status: 400 })
}
