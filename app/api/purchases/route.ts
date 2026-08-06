import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/api-auth'
import { adjustStock } from '@/lib/warehouse'
import { warehouseForStage } from '@/lib/stock-stages'
import { createPurchaseVoucher } from '@/lib/purchase-vouchers'

export async function GET() {
  const auth = await requirePermission('purchases', 'view')
  if ('response' in auth) return auth.response

  try {
    const purchases = await prisma.purchase.findMany({
      include: { supplier: true, items: { include: { product: true } }, creator: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(purchases)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission('purchases', 'add')
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const { supplierId, items, notes } = body
    const manualWarehouse = body.warehouseId || null
    const supplierInvoiceNo = body.supplierInvoiceNo?.trim() || null
    const invoiceImage = body.invoiceImage || null
    // سطور السداد الفوري (اختياري) — كل سطر: وسيلة دفع + خزنة + مبلغ + مرجع — لدعم توزيع الدفعة على أكتر من وسيلة
    const paymentLines = Array.isArray(body.paymentLines) ? body.paymentLines : []

    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'اختار المورد وأدخل صنف واحد على الأقل' }, { status: 400 })
    }

    // كل صنف بيدخل مخزن مرحلته (الخام يدخل مخزن الخام) — إلا لو اختار المستخدم مخزن معين
    const productStages = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
      select: { id: true, stageId: true },
    })
    const stageOf = new Map(productStages.map((p) => [p.id, p.stageId]))
    const warehouseOf = async (productId: string) =>
      manualWarehouse || (await warehouseForStage(stageOf.get(productId)))

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0)

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          invoiceNo: `PUR-${Date.now()}`,
          supplierInvoiceNo,
          invoiceImage,
          supplierId,
          totalAmount,
          paymentMethod: 'آجل',
          paidAmount: 0,
          paymentStatus: 'UNPAID',
          notes,
          createdById: session.user.id,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            })),
          },
        },
        include: { items: true },
      })

      for (const item of items) {
        const whId = await warehouseOf(item.productId)
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
        })
        await adjustStock(tx, whId, item.productId, item.quantity)
        await tx.warehouseIn.create({
          data: {
            productId: item.productId,
            warehouseId: whId,
            quantity: item.quantity,
            source: `أمر شراء ${created.invoiceNo}`,
            createdById: session.user.id,
          },
        })
      }

      // الالتزام الكامل بقيمة الفاتورة يُسجَّل على المورد فورًا — أي سداد بعدها بيقلّله
      await tx.supplier.update({
        where: { id: supplierId },
        data: { totalPurchases: { increment: totalAmount }, balance: { increment: totalAmount } },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'شراء',
          description: `فاتورة شراء ${created.invoiceNo}${supplierInvoiceNo ? ` (فاتورة مورد ${supplierInvoiceNo})` : ''}`,
          impact: `إجمالي ${totalAmount.toLocaleString('ar-EG')} ج.م`,
        },
      })

      // لو المستخدم سجّل دفعة فورية (كامل أو جزئي بأي عدد وسائل)، تتنفّذ في نفس الـ transaction
      if (paymentLines.length > 0) {
        await createPurchaseVoucher(tx, {
          purchaseId: created.id,
          lines: paymentLines,
          notes: 'سداد فوري وقت الشراء',
          createdById: session.user.id,
        })
      }

      return created
    })

    return NextResponse.json(purchase, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create purchase' }, { status: 500 })
  }
}
