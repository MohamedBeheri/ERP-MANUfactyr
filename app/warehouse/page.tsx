import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { effectivePermissions, canDoAction } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { ensureStockStages } from '@/lib/stock-stages'
import { WarehouseHub } from '@/components/warehouse-hub'

export const dynamic = 'force-dynamic'

export default async function WarehousePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const perms = effectivePermissions(session.user.role, (session.user as any).permissions)
  const canEdit = canDoAction(perms, 'warehouse', 'edit')

  await ensureStockStages() // يضمن وجود المخازن والمراحل وترحيل الأرصدة

  const [products, warehouseIns, warehouseOuts, warehouses, loads, unloads, keySupplies, whTreasuries, sales, outgoings, whSettlements] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { stocks: true, category: true, stockStage: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.warehouseIn.findMany({
      include: { product: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.warehouseOut.findMany({
      include: { product: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.deliveryOrder.findMany({
      include: {
        delegate: { include: { vehicle: true } },
        warehouse: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
        preparedBy: { select: { name: true } },
        creator: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.unloadOrder.findMany({
      include: {
        delegate: { include: { vehicle: true } },
        deliveryOrder: { select: { orderNo: true } },
        warehouse: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
        confirmedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.keyAccountSupply.findMany({
      include: {
        keyAccount: { select: { name: true } },
        branch: { select: { name: true } },
        warehouse: { select: { name: true } },
        creator: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    // خزائن المخازن (الأرصدة النقدية)
    prisma.treasury.findMany({ where: { type: 'WAREHOUSE_CASH' }, select: { warehouseId: true, balance: true } }),
    // بيع نقدي مباشر من المخزن
    prisma.warehouseSale.findMany({
      include: {
        warehouse: { select: { name: true } },
        creator: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    // خوارج الشركة (استهلاك داخلي)
    prisma.warehouseOutgoing.findMany({
      include: {
        warehouse: { select: { name: true } },
        creator: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    // تسويات خزائن المخازن
    prisma.treasurySettlement.findMany({
      where: { warehouseId: { not: null } },
      include: { warehouse: { select: { name: true } }, createdBy: { select: { name: true } }, acceptedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const categories = Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean))) as string[]

  const mapUnload = (u: (typeof unloads)[number]) => ({
    id: u.id,
    unloadNo: u.unloadNo,
    delegateName: u.delegate.name,
    vehicle: u.delegate.vehicle?.plateNo || u.delegate.carNumber || null,
    orderNo: u.deliveryOrder?.orderNo || null,
    warehouseName: u.warehouse?.name || null,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    confirmedByName: u.confirmedBy?.name || null,
    notes: u.notes,
    items: u.items.map((it) => ({
      id: it.id,
      name: it.product.name,
      unit: it.product.unit,
      quantity: Number(it.quantity),
      kind: it.kind,
    })),
  })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">المخزن</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            أوامر التحميل والتفريغ بتأكيد استلام · خوارج ووارد الشركة · رصيد الأصناف ببحث وفلاتر
          </p>
        </div>
        <Link href="/warehouse/adjustments" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-[#0f3460] text-white hover:bg-[#0a2545] shrink-0">
          <ClipboardCheck className="w-4 h-4" /> جرد المخزن
        </Link>
      </div>

      <WarehouseHub
        canEdit={canEdit}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
        categories={categories}
        stock={products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          category: p.category?.name || null,
          stageName: p.stockStage?.name || null,
          minStock: Number(p.minStock),
          costPrice: Number(p.costPrice),
          sellPrice: Number(p.sellPrice),
          wholesalePrice: Number(p.wholesalePrice),
          totalQty: Number(p.quantity),
          stocks: p.stocks.map((s) => ({ warehouseId: s.warehouseId, quantity: Number(s.quantity) })),
        }))}
        treasuryBalances={whTreasuries.map((t) => ({ warehouseId: t.warehouseId!, balance: Number(t.balance) }))}
        sales={sales.map((s) => ({
          id: s.id,
          saleNo: s.saleNo,
          warehouseName: s.warehouse?.name || null,
          buyerType: s.buyerType,
          buyerName: s.buyerName,
          totalAmount: Number(s.totalAmount),
          creatorName: s.creator.name,
          createdAt: s.createdAt.toISOString(),
          items: s.items.map((it) => ({ name: it.product.name, unit: it.product.unit, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
        }))}
        outgoings={outgoings.map((o) => ({
          id: o.id,
          outNo: o.outNo,
          warehouseName: o.warehouse?.name || null,
          target: o.target,
          costAmount: Number(o.costAmount),
          creatorName: o.creator.name,
          createdAt: o.createdAt.toISOString(),
          items: o.items.map((it) => ({ name: it.product.name, unit: it.product.unit, quantity: Number(it.quantity), unitCost: Number(it.unitCost) })),
        }))}
        settlements={whSettlements.map((s) => ({
          id: s.id,
          settlementNo: s.settlementNo,
          warehouseName: s.warehouse?.name || null,
          amount: Number(s.amount),
          status: s.status,
          createdByName: s.createdBy?.name || null,
          acceptedByName: s.acceptedBy?.name || null,
          createdAt: s.createdAt.toISOString(),
        }))}
        loads={loads.map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          delegateName: o.delegate.name,
          vehicle: o.delegate.vehicle?.plateNo || o.delegate.carNumber || null,
          warehouseName: o.warehouse?.name || null,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          items: o.items.map((it) => ({ name: it.product.name, unit: it.product.unit, quantity: Number(it.quantity) })),
          preparedAt: o.preparedAt ? o.preparedAt.toISOString() : null,
          preparedByName: o.preparedBy?.name || null,
          creatorName: o.creator.name,
          notes: o.notes,
        }))}
        unloads={unloads.map(mapUnload)}
        pendingUnloads={unloads.filter((u) => u.status === 'PENDING').map(mapUnload)}
        keySupplies={keySupplies.map((s) => ({
          id: s.id,
          supplyNo: s.supplyNo,
          accountName: s.keyAccount.name,
          branchName: s.branch.name,
          warehouseName: s.warehouse?.name || null,
          netAmount: Number(s.netAmount),
          creatorName: s.creator.name,
          createdAt: s.createdAt.toISOString(),
          items: s.items.map((it) => ({
            name: it.product.name,
            unit: it.product.unit,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
        }))}
        ins={warehouseIns.map((e) => ({
          id: e.id,
          productName: e.product.name,
          unit: e.product.unit,
          quantity: Number(e.quantity),
          label: `${e.source}${e.warehouse ? ` · ${e.warehouse.name}` : ''}`,
          createdAt: e.createdAt.toISOString(),
        }))}
        outs={warehouseOuts.map((e) => ({
          id: e.id,
          productName: e.product.name,
          unit: e.product.unit,
          quantity: Number(e.quantity),
          label: `${e.target} · ${e.reason}${e.warehouse ? ` · ${e.warehouse.name}` : ''}`,
          createdAt: e.createdAt.toISOString(),
        }))}
        stocktakeProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          stocksByWarehouse: Object.fromEntries(p.stocks.map((s) => [s.warehouseId, Number(s.quantity)])),
        }))}
      />
    </div>
  )
}
