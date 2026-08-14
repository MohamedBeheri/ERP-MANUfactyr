import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock } from '@/lib/warehouse'
import { getGLAccounts, nextDocNo } from '@/lib/accounting'

// اعتماد وترحيل التسوية:
//  • تطبيق حركات المخزون التصحيحية (عجز = صرف · زيادة = إضافة)
//  • إنشاء قيد يومية آلي مجمّع (Compound JE) — عجز: مدين خسائر/دائن مخزون · زيادة: مدين مخزون/دائن أرباح
//  • قفل المستند نهائيًا (POSTED)
export async function POST(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('warehouse', 'edit')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const { session } = auth
  // نوع الاعتماد: DIRECT = اعتماد مباشر (تصحيح المخزون بدون قيد محاسبي) · SETTLEMENT = اعتماد وتسوية بقيد يومية
  let mode: 'DIRECT' | 'SETTLEMENT' = 'SETTLEMENT'
  try { const b = await req.json(); if (b?.mode === 'DIRECT') mode = 'DIRECT' } catch {}

  try {
    const adj = await prisma.stockAdjustment.findUnique({ where: { id: params.id }, include: { items: { include: { product: { select: { name: true, lotTracked: true } } } } } })
    if (!adj) return NextResponse.json({ error: 'مستند التسوية غير موجود' }, { status: 404 })
    if (adj.status !== 'REVIEWING') {
      return NextResponse.json({ error: 'لازم تخلّص العدّ وتراجع الفروق قبل الترحيل' }, { status: 400 })
    }
    const counted = adj.items.filter((it) => it.countedQty != null)
    if (counted.length === 0) return NextResponse.json({ error: 'مفيش أصناف اتعدّت — اكتب الكميات الفعلية الأول' }, { status: 400 })

    // (١) إقفال الفترة المالية/المخزنية
    const settings = await prisma.accountingSettings.findFirst()
    if (settings?.periodLockDate && new Date() <= new Date(settings.periodLockDate)) {
      return NextResponse.json({ error: `الفترة مقفولة لحد ${new Date(settings.periodLockDate).toLocaleDateString('ar-EG')} — مينفعش ترحّل جواها` }, { status: 400 })
    }

    // احترام نوع التسوية
    const applicable = adj.items.filter((it) => {
      if (it.countedQty == null || Number(it.varianceQty) === 0) return false
      if (adj.adjustmentType === 'SHORTAGE_ONLY') return Number(it.varianceQty) < 0
      if (adj.adjustmentType === 'SURPLUS_ONLY') return Number(it.varianceQty) > 0
      return true
    })

    // (٢) إلزام اللوت/الصلاحية للأصناف الزائدة اللي بنظام اللوت
    const missingLot = applicable.filter((it) => Number(it.varianceQty) > 0 && it.product.lotTracked && (!it.batchNo || !it.batchNo.trim()))
    if (missingLot.length > 0) {
      return NextResponse.json({ error: `أصناف بنظام اللوت لازم رقم لوت للكمية الزائدة: ${missingLot.map((i) => i.product.name).join('، ')}` }, { status: 400 })
    }

    const shortageCost = applicable.filter((i) => Number(i.varianceQty) < 0).reduce((s, i) => s + Math.abs(Number(i.varianceCost)), 0)
    const surplusCost = applicable.filter((i) => Number(i.varianceQty) > 0).reduce((s, i) => s + Number(i.varianceCost), 0)

    // (٣) حد اعتماد المستخدم — إجمالي الفرق المالي (عجز + زيادة)
    const gross = shortageCost + surplusCost
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { adjustmentApprovalLimit: true } })
    const limit = Number(me?.adjustmentApprovalLimit || 0)
    if (session.user.role !== 'ADMIN' && limit > 0 && gross > limit) {
      return NextResponse.json({ error: `إجمالي الفرق (${gross.toLocaleString('ar-EG')} ج.م) أكبر من صلاحيتك (${limit.toLocaleString('ar-EG')} ج.م) — محتاج اعتماد أعلى` }, { status: 403 })
    }

    const gl = await getGLAccounts()

    const result = await prisma.$transaction(async (tx) => {
      // 1) حركات المخزون التصحيحية
      for (const it of applicable) {
        const delta = Number(it.varianceQty) // موجب = زيادة · سالب = عجز
        await tx.product.update({ where: { id: it.productId }, data: { quantity: { increment: delta } } })
        await adjustStock(tx, adj.warehouseId, it.productId, delta)
        if (delta < 0) {
          await tx.warehouseOut.create({ data: { productId: it.productId, warehouseId: adj.warehouseId, quantity: Math.abs(delta), target: 'تسوية جرد', reason: `عجز جرد — ${adj.docNo}`, createdById: session.user.id } })
        } else {
          await tx.warehouseIn.create({ data: { productId: it.productId, warehouseId: adj.warehouseId, quantity: delta, source: `زيادة جرد — ${adj.docNo}`, createdById: session.user.id } })
        }
      }

      // 2) قيد يومية آلي مجمّع — بيتعمل في التسوية المحاسبية بس (مش الاعتماد المباشر)
      //    مع احترام توجيه الحساب المخصّص لكل سطر (accountId)
      const acc: Record<string, { debit: number; credit: number }> = {}
      const add = (id: string, d: number, c: number) => { const a = acc[id] || (acc[id] = { debit: 0, credit: 0 }); a.debit += d; a.credit += c }
      if (mode === 'SETTLEMENT') {
        for (const it of applicable) {
          const cost = Math.abs(Number(it.varianceCost))
          if (cost === 0) continue
          if (Number(it.varianceQty) < 0) {
            add(it.accountId || gl.loss.id, cost, 0)
            add(gl.inventory.id, 0, cost)
          } else {
            add(gl.inventory.id, cost, 0)
            add(it.accountId || gl.gain.id, 0, cost)
          }
        }
      }
      // نصفّي كل حساب لطرف واحد (مدين أو دائن) عشان القيد يفضل متوازن
      const lines = Object.entries(acc)
        .map(([accountId, { debit, credit }]) => {
          const net = +(debit - credit).toFixed(2)
          return net >= 0 ? { accountId, debit: net, credit: 0 } : { accountId, debit: 0, credit: -net }
        })
        .filter((l) => l.debit > 0 || l.credit > 0)
      let journalEntryId: string | null = null
      if (lines.length > 0) {
        const entryNo = await nextDocNo(tx, 'JV', 'journalEntry')
        const je = await tx.journalEntry.create({
          data: {
            entryNo,
            description: `تسوية جرد ${adj.docNo} — مخزن ${adj.warehouseId}`,
            sourceType: 'STOCK_ADJUSTMENT',
            sourceId: adj.id,
            createdById: session.user.id,
            lines: { create: lines },
          },
        })
        journalEntryId = je.id
      }

      // 3) قفل المستند
      const posted = await tx.stockAdjustment.update({
        where: { id: adj.id },
        data: {
          status: 'POSTED',
          postingDate: new Date(),
          approvedById: session.user.id,
          journalEntryId,
          shortageCost,
          surplusCost,
          totalVarianceCost: +(surplusCost - shortageCost).toFixed(2),
        },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: mode === 'DIRECT' ? 'اعتماد مباشر لتسوية جرد' : 'اعتماد وتسوية محاسبية لجرد',
          description: `${mode === 'DIRECT' ? 'اعتماد مباشر' : 'تسوية محاسبية'} ${adj.docNo} (${applicable.length} صنف)`,
          impact: `عجز ${shortageCost.toFixed(2)} · زيادة ${surplusCost.toFixed(2)} · صافي ${(surplusCost - shortageCost).toFixed(2)} ج.م${mode === 'DIRECT' ? ' · بدون قيد محاسبي' : ' · بقيد يومية'}`,
        },
      })
      return posted
    })

    return NextResponse.json({ success: true, mode, shortageCost, surplusCost, adjustment: result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل ترحيل التسوية' }, { status: 500 })
  }
}
