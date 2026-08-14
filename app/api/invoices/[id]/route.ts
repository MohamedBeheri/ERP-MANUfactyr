import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAnyPermission } from '@/lib/api-auth'
import { reverseInvoiceEffects, applyInvoiceItems } from '@/lib/invoices'
import { getDefaultWarehouseId } from '@/lib/warehouse'
import { normalizeDigits } from '@/lib/numbers'

// تفاصيل فاتورة
export async function GET(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPermission(['sales', 'cafe_pos'], 'add')
  if ('response' in auth) return auth.response
  const params = await rawParams
  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { customer: { select: { name: true } }, creator: { select: { name: true } }, items: { include: { product: { select: { name: true, unit: true } } } } },
  })
  if (!inv) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
  return NextResponse.json(inv)
}

// حذف فاتورة — الأدمن فقط — بعكس كل آثارها (مخزون + خزائن + أرصدة العميل)
export async function DELETE(_req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPermission(['sales', 'cafe_pos'], 'delete')
  if ('response' in auth) return auth.response
  const { session } = auth
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'حذف الفواتير من صلاحية مدير النظام فقط' }, { status: 403 })
  const params = await rawParams

  try {
    const result = await prisma.$transaction(async (tx) => {
      const inv = await reverseInvoiceEffects(tx, params.id)
      await tx.invoiceItem.deleteMany({ where: { invoiceId: inv.id } })
      await tx.invoice.delete({ where: { id: inv.id } })
      await tx.auditLog.create({
        data: { userId: session.user.id, action: 'حذف فاتورة', description: `حذف فاتورة ${inv.invoiceNo}`, impact: `-${Number(inv.netAmount).toFixed(2)} ج.م · عكس المخزون والخزائن` },
      })
      return inv
    })
    return NextResponse.json({ success: true, invoiceNo: result.invoiceNo })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل حذف الفاتورة' }, { status: 500 })
  }
}

// تعديل فاتورة — الأدمن فقط — بعكس الآثار القديمة وإعادة تطبيق البنود الجديدة
export async function PUT(req: NextRequest, { params: rawParams }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPermission(['sales', 'cafe_pos'], 'edit')
  if ('response' in auth) return auth.response
  const { session } = auth
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'تعديل الفواتير من صلاحية مدير النظام فقط' }, { status: 403 })
  const params = await rawParams

  try {
    const b = await req.json()
    const rawItems: any[] = Array.isArray(b.items) ? b.items : []
    const items = rawItems
      .map((it) => ({ productId: it.productId, quantity: Number(normalizeDigits(String(it.quantity ?? ''))) || 0, unitPrice: Number(normalizeDigits(String(it.unitPrice ?? ''))) || 0 }))
      .filter((it) => it.productId && it.quantity > 0)
    if (items.length === 0) return NextResponse.json({ error: 'لازم صنف واحد على الأقل بكمية' }, { status: 400 })

    const existing = await prisma.invoice.findUnique({ where: { id: params.id }, include: { items: true } })
    if (!existing) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })

    const discount = Number(normalizeDigits(String(b.discount ?? existing.discount))) || 0
    const type = b.type === 'CREDIT' ? 'CREDIT' : 'CASH'
    const paymentMethod = type === 'CREDIT' ? 'آجل' : (b.paymentMethod || existing.paymentMethod || 'نقدي')
    const customerId = b.customerId || existing.customerId
    const cafeSale = existing.items.length >= 0 && !!b.cafeSale // نحتفظ بكون الفاتورة كافيه لو الواجهة بعتتها
    const warehouseId = b.warehouseId || (await getDefaultWarehouseId())

    const totalAmount = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const netAmount = totalAmount - (totalAmount * discount) / 100

    // الآجل لعملاء الجملة فقط
    if (type === 'CREDIT') {
      const c = await prisma.customer.findUnique({ where: { id: customerId } })
      if (!c || c.customerType !== 'WHOLESALE') return NextResponse.json({ error: 'الآجل متاح لعملاء الجملة فقط' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1) عكس الآثار القديمة (بيرجّع المخزون فيتاح للتعديل الجديد)
      await reverseInvoiceEffects(tx, params.id)
      // 2) استبدال البنود + تحديث رأس الفاتورة
      await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } })
      const inv = await tx.invoice.update({
        where: { id: params.id },
        data: {
          customerId, discount, type, totalAmount, netAmount,
          paymentMethod,
          items: { create: items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, totalPrice: it.quantity * it.unitPrice })) },
        },
      })
      // 3) إعادة تطبيق الآثار بالبنود الجديدة
      await applyInvoiceItems(tx, { id: inv.id, invoiceNo: inv.invoiceNo, customerId, netAmount, type }, { items, warehouseId, cafeSale, paymentMethod, createdById: session.user.id })
      await tx.auditLog.create({
        data: { userId: session.user.id, action: 'تعديل فاتورة', description: `تعديل فاتورة ${inv.invoiceNo}`, impact: `الصافي الجديد ${netAmount.toFixed(2)} ج.م` },
      })
      return inv
    })
    return NextResponse.json({ success: true, invoiceNo: updated.invoiceNo })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل تعديل الفاتورة' }, { status: 500 })
  }
}
