import { prisma } from '@/lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma

// المخزن الافتراضي — لو مفيش مخازن خالص بينشئ "المخزن الرئيسي"
// وينقل الكميات الحالية من الأصناف لأرصدة المخزن ده (توافق مع البيانات القديمة)
export async function getDefaultWarehouseId(): Promise<string> {
  const existing = await prisma.warehouse.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (existing) return existing.id

  const created = await prisma.$transaction(async (tx) => {
    const wh = await tx.warehouse.create({
      data: { name: 'المخزن الرئيسي', isDefault: true },
    })
    const products = await tx.product.findMany({ select: { id: true, quantity: true } })
    if (products.length > 0) {
      await tx.productStock.createMany({
        data: products.map((p) => ({ warehouseId: wh.id, productId: p.id, quantity: p.quantity })),
      })
    }
    return wh
  })
  return created.id
}

// تعديل رصيد صنف في مخزن معيّن (زيادة أو نقص)
export async function adjustStock(tx: Tx, warehouseId: string, productId: string, delta: number) {
  await (tx as typeof prisma).productStock.upsert({
    where: { warehouseId_productId: { warehouseId, productId } },
    create: { warehouseId, productId, quantity: Math.max(0, delta) },
    update: { quantity: { increment: delta } },
  })
}

// رصيد صنف في مخزن معيّن
export async function getStock(warehouseId: string, productId: string): Promise<number> {
  const stock = await prisma.productStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  })
  return stock?.quantity ?? 0
}
