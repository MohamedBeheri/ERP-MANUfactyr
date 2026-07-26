import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// إعادة تهيئة كامل البيانات التشغيلية.
// بيسيب فقط: حساب الأدمن، المخازن، المراحل المخزنية، عمليات التصنيع، فئات العملاء الافتراضية،
// إعدادات المتجر (لو موجودة). كل حاجة تانية بتتمسح.

async function main() {
  console.log('⚠️  بدء إعادة التهيئة الكاملة للبيانات التشغيلية...\n')

  // === الترتيب مهم عشان علاقات FK ===
  // 1) بنود ومستندات الحركة
  await prisma.deliveryReturnItem.deleteMany({}); console.log('✓ delivery return items')
  await prisma.deliveryReturn.deleteMany({}); console.log('✓ delivery returns')
  await prisma.keyAccountSupplyItem.deleteMany({}); console.log('✓ key account supply items')
  await prisma.keyAccountSupply.deleteMany({}); console.log('✓ key account supplies')
  await prisma.keyAccountPayment.deleteMany({}); console.log('✓ key account payments')
  await prisma.priceQuoteItem.deleteMany({}); console.log('✓ price quote items')
  await prisma.priceQuote.deleteMany({}); console.log('✓ price quotes')
  await prisma.keyAccountBranch.deleteMany({}); console.log('✓ key account branches')
  await prisma.keyAccount.deleteMany({}); console.log('✓ key accounts')

  await prisma.invoiceItem.deleteMany({}); console.log('✓ invoice items')
  await prisma.invoice.deleteMany({}); console.log('✓ invoices')

  await prisma.deliveryItem.deleteMany({}); console.log('✓ delivery items')
  await prisma.settlement.deleteMany({}); console.log('✓ settlements')
  await prisma.deliveryOrder.deleteMany({}); console.log('✓ delivery orders')

  await prisma.onlineOrderItem.deleteMany({}); console.log('✓ online order items')
  await prisma.onlineOrder.deleteMany({}); console.log('✓ online orders')

  await prisma.supplierPayment.deleteMany({}); console.log('✓ supplier payments')
  await prisma.purchaseItem.deleteMany({}); console.log('✓ purchase items')
  await prisma.purchase.deleteMany({}); console.log('✓ purchases')

  await prisma.productionItem.deleteMany({}); console.log('✓ production items')
  await prisma.productionInput.deleteMany({}); console.log('✓ production inputs')
  await prisma.production.deleteMany({}); console.log('✓ productions (batches)')
  await prisma.productionStage.deleteMany({}).catch(() => {}); console.log('✓ production stages')

  await prisma.recipeItem.deleteMany({}); console.log('✓ recipe items')
  await prisma.recipe.deleteMany({}); console.log('✓ recipes')
  await prisma.rewardRule.deleteMany({}); console.log('✓ reward rules')

  await prisma.warehouseIn.deleteMany({}); console.log('✓ warehouse in')
  await prisma.warehouseOut.deleteMany({}); console.log('✓ warehouse out')
  await prisma.productStock.deleteMany({}); console.log('✓ product stock (balances)')

  // 2) الأصناف والتوليفات
  await prisma.blendComponent.deleteMany({}); console.log('✓ blend components')
  await prisma.product.deleteMany({}); console.log('✓ products (بنك الأصناف)')
  await prisma.category.deleteMany({}); console.log('✓ categories')

  // 3) العملاء والمناديب
  await prisma.customer.deleteMany({}); console.log('✓ customers')
  await prisma.delegate.deleteMany({}); console.log('✓ delegates')
  await prisma.vehicle.deleteMany({}); console.log('✓ vehicles')
  await prisma.supplier.deleteMany({}); console.log('✓ suppliers')
  await prisma.salesPoint.deleteMany({}); console.log('✓ sales points')

  // 4) المتجر الإلكتروني (المحتوى — الإعدادات تفضل)
  await prisma.heroSlide.deleteMany({}); console.log('✓ hero slides')
  await prisma.storeBlock.deleteMany({}); console.log('✓ store blocks')

  // 5) اللوجز
  await prisma.cashFlow.deleteMany({}).catch(() => {}); console.log('✓ cash flow')
  await prisma.auditLog.deleteMany({}); console.log('✓ audit logs')

  // 6) مستخدمون غير أدمن (فقط حسابات محاسب/مبيعات/مصنع/مندوب)
  const nonAdmins = await prisma.user.deleteMany({ where: { role: { not: 'ADMIN' } } })
  console.log(`✓ non-admin users (${nonAdmins.count})`)

  console.log('\n=== الاحتفظنا بيه ===')
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } })
  const wh = await prisma.warehouse.count()
  const stages = await prisma.stockStage.count()
  const ops = await prisma.productionOperation.count()
  const tiers = await prisma.customerTier.count()
  console.log(`  حسابات أدمن: ${admins}`)
  console.log(`  المخازن: ${wh}`)
  console.log(`  المراحل المخزنية: ${stages}`)
  console.log(`  عمليات التصنيع: ${ops}`)
  console.log(`  فئات العملاء: ${tiers}`)

  console.log('\n✅ الداتا بيز فاضية والنظام جاهز للإدخال اليدوي.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('❌ فشل:', e)
  await prisma.$disconnect()
  process.exit(1)
})
