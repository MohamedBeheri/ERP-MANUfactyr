import { prisma } from '@/lib/prisma'

export interface ReconciliationData {
  from: Date
  to: Date
  channels: string[]
  greens: { name: string; kg: number; roastLoss: number }[]
  spices: { name: string; kg: number }[]
  packaging: { name: string; pieces: number }[]
  blends: { name: string; output: number; waste: number; input: number; lossPercent: number }[]
  finished: { name: string; boxes: number; coffeeKg: number }[]
  ordersCount: number
}

// محضر التشغيل: يجمع أوامر التصنيع الجديدة (BLND/PACK) في فترة ويطابق المستهلك والمنتَج والهدر لكل قناة.
export async function computeReconciliation(from: Date, to: Date, channel?: string): Promise<ReconciliationData> {
  const productions = await prisma.production.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      OR: [{ orderNo: { startsWith: 'BLND-' } }, { orderNo: { startsWith: 'PACK-' } }],
      ...(channel ? { channel } : {}),
    },
    include: { inputs: { include: { product: true } }, items: { include: { product: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const greens = new Map<string, { name: string; kg: number; roastLoss: number }>()
  const spices = new Map<string, { name: string; kg: number }>()
  const packaging = new Map<string, { name: string; pieces: number }>()
  const blends = new Map<string, { name: string; output: number; waste: number; input: number }>()
  const finished = new Map<string, { name: string; boxes: number; coffeeKg: number }>()
  const channels = new Set<string>()

  for (const p of productions) {
    channels.add(p.channel)
    const isBlend = p.orderNo.startsWith('BLND-')
    for (const inp of p.inputs) {
      const k = inp.product.itemKind
      if (k === 'GREEN') {
        const g = greens.get(inp.productId) || { name: inp.product.name, kg: 0, roastLoss: Number(inp.product.roastLossPercent) }
        g.kg += inp.quantity
        greens.set(inp.productId, g)
      } else if (k === 'SPICE' || k === 'FLAVOR') {
        const s = spices.get(inp.productId) || { name: inp.product.name, kg: 0 }
        s.kg += inp.quantity
        spices.set(inp.productId, s)
      } else if (k === 'PACKAGING') {
        const pk = packaging.get(inp.productId) || { name: inp.product.name, pieces: 0 }
        pk.pieces += inp.quantity
        packaging.set(inp.productId, pk)
      }
    }
    if (isBlend) {
      for (const it of p.items) {
        const bl = blends.get(it.productId) || { name: it.product.name, output: 0, waste: 0, input: 0 }
        bl.output += it.quantity
        bl.waste += p.wasteWeight
        bl.input += p.inputWeight
        blends.set(it.productId, bl)
      }
    } else {
      for (const it of p.items) {
        const f = finished.get(it.productId) || { name: it.product.name, boxes: 0, coffeeKg: 0 }
        f.boxes += it.quantity
        f.coffeeKg += p.inputWeight
        finished.set(it.productId, f)
      }
    }
  }

  return {
    from,
    to,
    channels: Array.from(channels),
    greens: Array.from(greens.values()),
    spices: Array.from(spices.values()),
    packaging: Array.from(packaging.values()),
    blends: Array.from(blends.values()).map((b) => ({ ...b, lossPercent: b.input > 0 ? (b.waste / b.input) * 100 : 0 })),
    finished: Array.from(finished.values()),
    ordersCount: productions.length,
  }
}
