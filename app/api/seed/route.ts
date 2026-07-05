import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// One-time DB seeding endpoint. Gated by SEED_SECRET so it can't be triggered
// by anyone who just knows the URL - set SEED_SECRET in the environment and
// pass it as ?secret=... (or remove this route entirely after first deploy).
export async function POST(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get('secret')
    if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if already seeded
    const existingUsers = await prisma.user.count()
    if (existingUsers > 0) {
      return NextResponse.json({ message: 'Database already seeded!' })
    }

    const hashedPassword = await bcrypt.hash('123456', 10)

    // Create users
    const users = await Promise.all([
      prisma.user.create({ data: { name: 'مدير النظام', username: 'admin', password: hashedPassword, role: 'ADMIN' } }),
      prisma.user.create({ data: { name: 'مدير المصنع', username: 'factory', password: hashedPassword, role: 'FACTORY' } }),
      prisma.user.create({ data: { name: 'مدير المخزن', username: 'warehouse', password: hashedPassword, role: 'WAREHOUSE' } }),
      prisma.user.create({ data: { name: 'مدير المبيعات', username: 'sales', password: hashedPassword, role: 'SALES' } }),
      prisma.user.create({ data: { name: 'المحاسب', username: 'accountant', password: hashedPassword, role: 'ACCOUNTANT' } }),
    ])

    // Create products
    const products = await Promise.all([
      prisma.product.create({ data: { name: 'بن أخضر خام (إثيوبي)', type: 'RAW', costPrice: 45, sellPrice: 50, minStock: 200, quantity: 500, unit: 'كجم' } }),
      prisma.product.create({ data: { name: 'بن محمص 250جرام', type: 'FINISHED', costPrice: 28, sellPrice: 35, minStock: 50, quantity: 200, unit: 'علبة' } }),
      prisma.product.create({ data: { name: 'بن محمص 500جرام', type: 'FINISHED', costPrice: 52, sellPrice: 65, minStock: 30, quantity: 150, unit: 'علبة' } }),
      prisma.product.create({ data: { name: 'بن مطحون 250جرام', type: 'FINISHED', costPrice: 32, sellPrice: 40, minStock: 40, quantity: 100, unit: 'علبة' } }),
      prisma.product.create({ data: { name: 'بن محمص 1كجم', type: 'FINISHED', costPrice: 95, sellPrice: 120, minStock: 20, quantity: 80, unit: 'علبة' } }),
    ])

    // Create supplier
    const supplier = await prisma.supplier.create({
      data: { name: 'مورد البن الأخضر - إثيوبيا', phone: '01001234567', address: 'ميناء الإسكندرية', totalPurchases: 22500 }
    })

    // Create sales point
    const point = await prisma.salesPoint.create({
      data: { name: 'الفرع الرئيسي', address: '15 شارع القاهرة', phone: '0223456789', manager: 'أحمد علي' }
    })

    // Create customers
    const customers = await Promise.all([
      prisma.customer.create({ data: { name: 'محمد علي - سوبر ماركت', phone: '01003334455', address: 'مدينة نصر', type: 'CASH', totalPurchases: 350 } }),
      prisma.customer.create({ data: { name: 'أحمد محمود - كافيه', phone: '01004445566', address: 'القاهرة الجديدة', type: 'CREDIT', creditLimit: 5000, balance: 315, totalPurchases: 315 } }),
    ])

    // Create delegates
    const delegates = await Promise.all([
      prisma.delegate.create({ data: { name: 'أحمد السيد', phone: '01001112233', carNumber: 'أ ب ج 1234', area: 'مدينة نصر', commissionRate: 5, totalSales: 675, commissionDue: 33.75 } }),
      prisma.delegate.create({ data: { name: 'محمد كمال', phone: '01002223344', carNumber: 'أ ب ج 5678', area: 'القاهرة الجديدة', commissionRate: 5 } }),
    ])

    // Create purchase
    await prisma.purchase.create({
      data: {
        invoiceNo: 'PUR-001', supplierId: supplier.id, totalAmount: 22500, notes: 'شحنة يونيو',
        createdById: users[1].id,
        items: { create: { productId: products[0].id, quantity: 500, unitPrice: 45, totalPrice: 22500 } }
      }
    })

    // Create production
    const production = await prisma.production.create({
      data: {
        orderNo: 'PROD-001', rawUsed: 250, opCost: 1500,
        createdById: users[1].id,
        items: { create: { productId: products[1].id, quantity: 200 } }
      }
    })

    // Warehouse in
    await prisma.warehouseIn.create({
      data: { productId: products[1].id, quantity: 200, source: 'المصنع - أمر تصنيع #PROD-001', createdById: users[2].id }
    })

    // Delivery order
    await prisma.deliveryOrder.create({
      data: {
        orderNo: 'DEL-001', delegateId: delegates[0].id, createdById: users[2].id,
        items: { create: { productId: products[1].id, quantity: 50 } }
      }
    })

    // Invoices
    await prisma.invoice.create({
      data: {
        invoiceNo: 'INV-001', customerId: customers[0].id, totalAmount: 350, netAmount: 350, type: 'CASH', pointId: point.id, createdById: users[3].id,
        items: { create: { productId: products[1].id, quantity: 10, unitPrice: 35, totalPrice: 350 } }
      }
    })

    await prisma.invoice.create({
      data: {
        invoiceNo: 'INV-002', customerId: customers[1].id, totalAmount: 325, discount: 10, netAmount: 315, type: 'CREDIT', pointId: point.id, createdById: users[3].id,
        items: { create: { productId: products[2].id, quantity: 5, unitPrice: 65, totalPrice: 325 } }
      }
    })

    // Settlement
    await prisma.settlement.create({
      data: { delegateId: delegates[0].id, soldQty: 40, returnedQty: 5, cashAmount: 1225, commission: 61.25, createdById: users[3].id }
    })

    // Cash flow
    await prisma.cashFlow.createMany({
      data: [
        { description: 'شراء بن أخضر - فاتورة PUR-001', type: 'OUT', amount: 22500, balance: -22500, reference: 'PUR-001' },
        { description: 'تكاليف تصنيع - أمر PROD-001', type: 'OUT', amount: 1500, balance: -24000, reference: 'PROD-001' },
        { description: 'بيع نقدي - فاتورة INV-001', type: 'IN', amount: 350, balance: -23650, reference: 'INV-001' },
        { description: 'بيع آجل - فاتورة INV-002', type: 'IN', amount: 315, balance: -23335, reference: 'INV-002' },
      ]
    })

    // Audit logs
    await prisma.auditLog.createMany({
      data: [
        { userId: users[1].id, action: 'شراء', description: 'فاتورة شراء بن أخضر PUR-001', impact: '+500 كجم', ipAddress: '192.168.1.10' },
        { userId: users[1].id, action: 'تصنيع', description: 'أمر تصنيع بن محمص 250جرام PROD-001', impact: '+200 علبة', ipAddress: '192.168.1.10' },
        { userId: users[2].id, action: 'تسليم', description: 'أمر تسليم لأحمد السيد DEL-001', impact: '-50 علبة', ipAddress: '192.168.1.11' },
        { userId: users[3].id, action: 'بيع', description: 'فاتورة بيع نقدي INV-001', impact: '+350 ج.م', ipAddress: '192.168.1.12' },
        { userId: users[3].id, action: 'بيع', description: 'فاتورة بيع آجل INV-002', impact: '+315 ج.م', ipAddress: '192.168.1.12' },
      ]
    })

    return NextResponse.json({ success: true, message: 'Database seeded successfully!' })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed database', details: (error as Error).message }, { status: 500 })
  }
}
