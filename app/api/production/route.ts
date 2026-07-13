import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { getDefaultWarehouseId, adjustStock, getStock } from '@/lib/warehouse'

const ALLOWED_ROLES = ['ADMIN', 'FACTORY'] as const

export async function GET() {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response

  try {
    const productions = await prisma.production.findMany({
      include: {
        inputs: { include: { product: true } },
        items: { include: { product: true } },
        rawProduct: true,
        recipe: true,
        creator: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(productions)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch production' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...ALLOWED_ROLES])
  if ('response' in auth) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const {
      lineType, // ROASTING | PROCESSING (توافق قديم)
      operationId, // عملية التصنيع (تحدد مرحلة السحب والإنتاج)
      stage,
      batchNo,
      roastLevel,
      grindType,
      expiryDate,
      recipeId,
      opCost,
      notes,
      inputs, // [{ productId, quantity }]
      items, // [{ productId, quantity }]
    } = body
    const warehouseId = body.warehouseId || (await getDefaultWarehouseId())

    // تحقق أساسي
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json({ error: 'أدخل خامة واحدة على الأقل في المدخلات' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'أدخل منتج ناتج واحد على الأقل' }, { status: 400 })
    }

    // العملية بتحدد المرحلة المخزنية للسحب والإنتاج
    const operation = operationId
      ? await prisma.productionOperation.findUnique({ where: { id: operationId } })
      : null
    const derivedLine = operation
      ? operation.hasYieldLoss
        ? 'ROASTING'
        : 'PROCESSING'
      : lineType === 'PROCESSING'
        ? 'PROCESSING'
        : 'ROASTING'

    const cleanInputs = inputs
      .filter((i: any) => i.productId && Number(i.quantity) > 0)
      .map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity) }))
    const cleanItems = items
      .filter((i: any) => i.productId && Number(i.quantity) > 0)
      .map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity) }))

    if (cleanInputs.length === 0 || cleanItems.length === 0) {
      return NextResponse.json({ error: 'تأكد من إدخال كميات صحيحة للمدخلات والمخرجات' }, { status: 400 })
    }

    // تحقق من رصيد كل خامة + إن مرحلتها المخزنية تطابق مدخل العملية
    for (const inp of cleanInputs) {
      const product = await prisma.product.findUnique({ where: { id: inp.productId } })
      if (!product) {
        return NextResponse.json({ error: 'خامة غير موجودة' }, { status: 400 })
      }
      if (operation?.inputStageId && product.stageId && product.stageId !== operation.inputStageId) {
        return NextResponse.json(
          { error: `${product.name} مش من مرحلة السحب الصحيحة للعملية دي` },
          { status: 400 }
        )
      }
      const stock = await getStock(warehouseId, inp.productId)
      if (stock < inp.quantity) {
        return NextResponse.json(
          { error: `رصيد ${product.name} في المخزن ده غير كافي (المتاح: ${stock} ${product.unit})` },
          { status: 400 }
        )
      }
    }

    // تحقق إن المخرجات في مرحلة الإنتاج الصحيحة للعملية
    if (operation?.outputStageId) {
      for (const item of cleanItems) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } })
        if (product?.stageId && product.stageId !== operation.outputStageId) {
          return NextResponse.json(
            { error: `${product.name} مش من مرحلة الإنتاج الصحيحة للعملية دي` },
            { status: 400 }
          )
        }
      }
    }

    const inputWeight = cleanInputs.reduce((s, i) => s + i.quantity, 0)
    const outputWeight = cleanItems.reduce((s, i) => s + i.quantity, 0)
    const wasteWeight = Math.max(0, inputWeight - outputWeight)
    const wastePercent = inputWeight > 0 ? (wasteWeight / inputWeight) * 100 : 0

    // نسب الخامات في الخلطة (BOM)
    const inputsWithPct = cleanInputs.map((i) => ({
      ...i,
      percentage: inputWeight > 0 ? Number(((i.quantity / inputWeight) * 100).toFixed(2)) : 0,
    }))

    const production = await prisma.$transaction(async (tx) => {
      const created = await tx.production.create({
        data: {
          orderNo: `PROD-${Date.now()}`,
          lineType: derivedLine,
          operationId: operation?.id || null,
          stage: stage || operation?.name || (derivedLine === 'PROCESSING' ? 'خلط وطحن وتعبئة' : 'تحميص'),
          batchNo: batchNo || null,
          roastLevel: roastLevel || null,
          grindType: grindType || null,
          inputWeight,
          outputWeight,
          wasteWeight,
          wastePercent,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          recipeId: recipeId || null,
          rawProductId: cleanInputs[0].productId, // توافق قديم
          rawUsed: inputWeight,
          opCost: Number(opCost) || 0,
          notes,
          createdById: session.user.id,
          inputs: { create: inputsWithPct },
          items: { create: cleanItems },
        },
        include: { inputs: true, items: true },
      })

      // صرف كل الخامات المدخلة + إذن صرف
      for (const inp of cleanInputs) {
        await tx.product.update({
          where: { id: inp.productId },
          data: { quantity: { decrement: inp.quantity } },
        })
        await adjustStock(tx, warehouseId, inp.productId, -inp.quantity)
        await tx.warehouseOut.create({
          data: {
            productId: inp.productId,
            warehouseId,
            quantity: inp.quantity,
            target: 'خط الإنتاج',
            reason: `أمر تصنيع ${created.orderNo} (${created.stage})`,
            createdById: session.user.id,
          },
        })
      }

      // إضافة المنتجات الناتجة + إذن إضافة
      for (const item of cleanItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
        })
        await adjustStock(tx, warehouseId, item.productId, item.quantity)
        await tx.warehouseIn.create({
          data: {
            productId: item.productId,
            warehouseId,
            quantity: item.quantity,
            source: `المصنع - أمر تصنيع ${created.orderNo}${batchNo ? ` (تشغيلة ${batchNo})` : ''}`,
            createdById: session.user.id,
          },
        })
      }

      const lineLabel = created.lineType === 'PROCESSING' ? 'خلط وطحن' : 'تحميص'
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'تصنيع',
          description: `أمر تصنيع ${created.orderNo} — ${lineLabel} (${created.stage})${batchNo ? ` تشغيلة ${batchNo}` : ''}`,
          impact: `مدخل ${inputWeight} / ناتج ${outputWeight} / هدر ${wasteWeight} (${wastePercent.toFixed(1)}%)`,
        },
      })

      return created
    })

    return NextResponse.json(production, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create production' }, { status: 500 })
  }
}
