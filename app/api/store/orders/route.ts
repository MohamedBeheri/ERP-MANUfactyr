import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSettings } from '@/lib/store'
import { warehouseForStage } from '@/lib/stock-stages'
import { getStock } from '@/lib/warehouse'

// طلب أونلاين من العميل (عام — من غير تسجيل دخول موظف)
export async function POST(req: NextRequest) {
  try {
    const settings = await getStoreSettings()
    if (!settings.isOpen) {
      return NextResponse.json({ error: 'المتجر مقفول حاليًا، حاول لاحقًا' }, { status: 400 })
    }

    const body = await req.json()
    const { customerName, phone, address, notes, items } = body as {
      customerName: string
      phone: string
      address: string
      notes?: string
      items: { productId: string; quantity: number }[]
    }

    if (!customerName?.trim() || !phone?.trim() || !address?.trim()) {
      return NextResponse.json({ error: 'الاسم والتليفون والعنوان مطلوبين' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'السلة فاضية' }, { status: 400 })
    }

    // مخزن البيع أونلاين
    const storeWarehouse = settings.warehouseId || (await warehouseForStage(null))

    // تحقق من المنتجات والرصيد وحساب الإجمالي
    const orderItems: { productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }[] = []
    let subtotal = 0
    for (const it of items) {
      const qty = Math.max(1, Math.floor(Number(it.quantity) || 0))
      const product = await prisma.product.findUnique({ where: { id: it.productId } })
      if (!product || !product.isActive) {
        return NextResponse.json({ error: 'منتج غير متاح' }, { status: 400 })
      }
      const stock = await getStock(storeWarehouse, it.productId)
      if (stock < qty) {
        return NextResponse.json({ error: `الكمية المطلوبة من ${product.name} مش متاحة` }, { status: 400 })
      }
      const unitPrice = Number(product.sellPrice)
      const totalPrice = unitPrice * qty
      subtotal += totalPrice
      orderItems.push({ productId: product.id, productName: product.name, quantity: qty, unitPrice, totalPrice })
    }

    const minOrder = Number(settings.minOrder)
    if (minOrder > 0 && subtotal < minOrder) {
      return NextResponse.json({ error: `الحد الأدنى للطلب ${minOrder} ج.م` }, { status: 400 })
    }

    const deliveryFee = Number(settings.deliveryFee)
    const total = subtotal + deliveryFee

    // ربط/إنشاء عميل بناءً على التليفون
    let customer = await prisma.customer.findFirst({ where: { phone: phone.trim() } })
    if (!customer) {
      customer = await prisma.customer.create({
        data: { name: customerName.trim(), phone: phone.trim(), address: address.trim(), type: 'CASH', customerType: 'RETAIL' },
      })
    }

    const order = await prisma.onlineOrder.create({
      data: {
        orderNo: `WEB-${Date.now()}`,
        customerId: customer.id,
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes?.trim() || null,
        subtotal,
        deliveryFee,
        total,
        paymentMethod: 'الدفع عند الاستلام',
        warehouseId: storeWarehouse,
        items: { create: orderItems },
      },
    })

    return NextResponse.json({ success: true, orderNo: order.orderNo }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'فشل إرسال الطلب — حاول تاني' }, { status: 500 })
  }
}
