import { prisma } from '@/lib/prisma'

export interface ReconciliationData {
  from: Date
  to: Date
  channels: string[]
  // تحميص
  greens: { name: string; kg: number; roastLoss: number }[]
  roasted: { name: string; kg: number; wasteKg: number; wastePct: number }[]
  roastCount: number
  // توليف وطحن
  spices: { name: string; kg: number }[]
  blends: { name: string; output: number; waste: number; input: number; lossPercent: number }[]
  blendCount: number
  // تعبئة
  finished: { name: string; bags: number; coffeeKg: number; wasteKg: number; wastePct: number }[]
  packaging: { name: string; pieces: number }[]
  packCount: number
  ordersCount: number
}

// محضر التشغيل: يجمع كل أوامر التصنيع (RST/BLD/BLND/GRD/PACK) في فترة ويطابق لكل مرحلة.
export async function computeReconciliation(from: Date, to: Date, channel?: string): Promise<ReconciliationData> {
  const productions = await prisma.production.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      OR: [
        { orderNo: { startsWith: 'RST-' } },
        { orderNo: { startsWith: 'BLD-' } },
        { orderNo: { startsWith: 'BLND-' } },
        { orderNo: { startsWith: 'GRD-' } },
        { orderNo: { startsWith: 'PACK-' } },
      ],
      ...(channel ? { channel } : {}),
    },
    include: { inputs: { include: { product: true } }, items: { include: { product: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const greens = new Map<string, { name: string; kg: number; roastLoss: number }>()
  const roasted = new Map<string, { name: string; kg: number; wasteKg: number; inputKg: number }>()
  const spices = new Map<string, { name: string; kg: number }>()
  const packaging = new Map<string, { name: string; pieces: number }>()
  const blends = new Map<string, { name: string; output: number; waste: number; input: number }>()
  const finished = new Map<string, { name: string; bags: number; coffeeKg: number; wasteKg: number; inputKg: number }>()
  const channels = new Set<string>()
  let roastCount = 0, blendCount = 0, packCount = 0

  for (const p of productions) {
    channels.add(p.channel)
    const isRoast = p.orderNo.startsWith('RST-')
    const isBlend = p.orderNo.startsWith('BLD-') || p.orderNo.startsWith('BLND-') || p.orderNo.startsWith('GRD-')
    const isPack = p.orderNo.startsWith('PACK-')

    if (isRoast) {
      roastCount++
      // مدخلات التحميص = بن أخضر
      for (const inp of p.inputs) {
        if (inp.product.itemKind === 'GREEN') {
          const g = greens.get(inp.productId) || { name: inp.product.name, kg: 0, roastLoss: Number(inp.product.roastLossPercent) }
          g.kg += Number(inp.quantity)
          greens.set(inp.productId, g)
        }
      }
      // مخرجات التحميص = بن محمص
      if (p.status === 'COMPLETED') {
        for (const it of p.items) {
          const r = roasted.get(it.productId) || { name: it.product.name, kg: 0, wasteKg: 0, inputKg: 0 }
          r.kg += Number(it.quantity)
          r.wasteKg += Number(p.wasteWeight)
          r.inputKg += Number(p.inputWeight)
          roasted.set(it.productId, r)
        }
      }
    }

    if (isBlend) {
      blendCount++
      // مدخلات التوليف = محمص + نكهات + عطارة
      for (const inp of p.inputs) {
        const k = inp.product.itemKind
        if (k === 'SPICE' || k === 'FLAVOR') {
          const s = spices.get(inp.productId) || { name: inp.product.name, kg: 0 }
          s.kg += Number(inp.quantity)
          spices.set(inp.productId, s)
        }
      }
      // مخرجات التوليف
      for (const it of p.items) {
        const bl = blends.get(it.productId) || { name: it.product.name, output: 0, waste: 0, input: 0 }
        bl.output += Number(it.quantity)
        bl.waste += Number(p.wasteWeight)
        bl.input += Number(p.inputWeight)
        blends.set(it.productId, bl)
      }
    }

    if (isPack) {
      packCount++
      for (const inp of p.inputs) {
        if (inp.product.itemKind === 'PACKAGING') {
          const pk = packaging.get(inp.productId) || { name: inp.product.name, pieces: 0 }
          pk.pieces += Number(inp.quantity)
          packaging.set(inp.productId, pk)
        }
      }
      for (const it of p.items) {
        const f = finished.get(it.productId) || { name: it.product.name, bags: 0, coffeeKg: 0, wasteKg: 0, inputKg: 0 }
        f.bags += Number(it.quantity)
        f.coffeeKg += Number(p.inputWeight)
        f.wasteKg += Number(p.wasteWeight)
        f.inputKg += Number(p.inputWeight)
        finished.set(it.productId, f)
      }
    }
  }

  return {
    from,
    to,
    channels: Array.from(channels),
    greens: Array.from(greens.values()),
    roasted: Array.from(roasted.values()).map((r) => ({
      ...r,
      wastePct: r.inputKg > 0 ? +((r.wasteKg / r.inputKg) * 100).toFixed(2) : 0,
    })),
    roastCount,
    spices: Array.from(spices.values()),
    blends: Array.from(blends.values()).map((b) => ({ ...b, lossPercent: b.input > 0 ? +((b.waste / b.input) * 100).toFixed(2) : 0 })),
    blendCount,
    finished: Array.from(finished.values()).map((f) => ({
      ...f,
      wastePct: f.inputKg > 0 ? +((f.wasteKg / f.inputKg) * 100).toFixed(2) : 0,
    })),
    packaging: Array.from(packaging.values()),
    packCount,
    ordersCount: productions.length,
  }
}
