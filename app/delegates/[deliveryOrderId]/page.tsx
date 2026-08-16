import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Printer, Package, MapPin, FileCheck2, Undo2 } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeliverForm } from '@/components/deliver-form'
import { SettleForm } from '@/components/settle-form'
import { ReceiptConfirm } from '@/components/receipt-confirm'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'بانتظار استلام المندوب',
  IN_PROGRESS: 'شغالة',
  COMPLETED: 'اتسوّت',
  CANCELLED: 'ملغية',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-orange-50 text-orange-600',
  COMPLETED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-red-50 text-red-600',
}

export default async function DeliveryOrderPage({ params: rawParams }: { params: Promise<{ deliveryOrderId: string }> }) {
  const params = await rawParams;
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [deliveryOrder, allCustomers, rewardRules] = await Promise.all([
    prisma.deliveryOrder.findUnique({
      where: { id: params.deliveryOrderId },
      include: {
        delegate: true,
        settlement: true,
        preparedBy: { select: { name: true } },
        items: { include: { product: true } },
        invoices: {
          include: { customer: true, items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
        },
        keyAccountSupplies: {
          include: { branch: true, keyAccount: true, items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
        },
        returns: {
          include: { customer: true, items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, include: { tier: true } }),
    prisma.rewardRule.findMany({ where: { isActive: true } }),
  ])

  if (!deliveryOrder) notFound()

  // فلترة عملاء المندوب حسب خط سيره/منطقته (لو محدد)
  const delegateArea = deliveryOrder.delegate.area || deliveryOrder.delegate.route || null
  const customers = delegateArea
    ? allCustomers.filter((c) => !c.area || c.area === delegateArea)
    : allCustomers

  const remaining = deliveryOrder.items.map((item) => {
    const invDelivered = deliveryOrder.invoices
      .flatMap((inv) => inv.items)
      .filter((invItem) => invItem.productId === item.productId)
      .reduce((sum, invItem) => sum + Number(invItem.quantity), 0)
    const supDelivered = deliveryOrder.keyAccountSupplies
      .flatMap((sp) => sp.items)
      .filter((it) => it.productId === item.productId)
      .reduce((sum, it) => sum + Number(it.quantity), 0)
    const returnedToVan = deliveryOrder.returns
      .flatMap((r) => r.items)
      .filter((it) => it.productId === item.productId)
      .reduce((sum, it) => sum + Number(it.quantity), 0)
    const delivered = invDelivered + supDelivered

    return {
      productId: item.productId,
      productName: item.product.name,
      unit: item.product.unit,
      sellPrice: Number(item.product.sellPrice),
      wholesalePrice: Number(item.product.wholesalePrice),
      minKeyPrice: Number(item.product.minKeyPrice),
      loaded: Number(item.quantity),
      delivered,
      remaining: Number(item.quantity) - delivered + returnedToVan,
    }
  })

  // ملخص التوريدات لكل فرع من فروع كبار الموردين
  const supplyByBranch = new Map<string, { branch: string; account: string; qty: number; net: number }>()
  for (const sp of deliveryOrder.keyAccountSupplies) {
    const key = sp.branchId
    const prev = supplyByBranch.get(key) || { branch: sp.branch.name, account: sp.keyAccount.name, qty: 0, net: 0 }
    prev.qty += sp.items.reduce((s, it) => s + Number(it.quantity), 0)
    prev.net += Number(sp.netAmount)
    supplyByBranch.set(key, prev)
  }
  const branchSummary = Array.from(supplyByBranch.values())

  const cashTotal = deliveryOrder.invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
  const instapayTotal = deliveryOrder.invoices.filter((i) => i.collectionMethod === 'تحويل انستا').reduce((s, i) => s + Number(i.paidAmount), 0)
  const walletTotal = deliveryOrder.invoices.filter((i) => i.collectionMethod === 'تحويل محفظة').reduce((s, i) => s + Number(i.paidAmount), 0)
  const creditTotal = deliveryOrder.invoices.reduce((s, i) => s + (Number(i.netAmount) - Number(i.paidAmount)), 0)
  const returnsTotal = deliveryOrder.returns.reduce((s, r) => s + Number(r.totalValue), 0)

  const rewardRulesLite = rewardRules.map((r) => ({
    productId: r.productId,
    buyQuantity: r.buyQuantity,
    freeProductId: r.freeProductId,
    freeQuantity: r.freeQuantity,
    repeat: r.repeat,
    tierId: r.tierId,
  }))
  const customersLite = customers.map((c) => ({
    id: c.id,
    name: c.name,
    tierId: c.tierId,
    tierName: c.tier?.name || null,
    customerType: c.customerType,
    tier: c.tier ? { priceSource: c.tier.priceSource, discountPercent: Number(c.tier.discountPercent), bonusPercent: Number(c.tier.bonusPercent) } : null,
  }))
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* الترويسة */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/delegates"
            className="p-2 text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 rounded-lg"
            aria-label="رجوع للمندوبين"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#1a1a2e] tabular-nums">{deliveryOrder.orderNo}</h1>
            <p className="text-sm text-gray-500">
              {deliveryOrder.delegate.name} · {deliveryOrder.delegate.carNumber || 'بدون عربية'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/print/delivery/${deliveryOrder.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm font-medium hover:bg-[#0a2545]"
          >
            <Printer className="w-4 h-4" />
            أمر التحميل
          </Link>
          <Link
            href={`/print/day-report/${deliveryOrder.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-[#e9b44c] text-[#1a1a2e] rounded-lg text-sm font-bold hover:bg-[#d9a43c]"
          >
            <Printer className="w-4 h-4" />
            محضر اليوم
          </Link>
          {deliveryOrder.settlement && (
            <Link
              href={`/print/settlement/${deliveryOrder.settlement.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              <Printer className="w-4 h-4" />
              محضر التسوية
            </Link>
          )}
          {deliveryOrder.status === 'PENDING' && (
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${deliveryOrder.preparedAt ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
              {deliveryOrder.preparedAt ? 'المخزن جهّز ✓' : 'المخزن بيجهّز'}
            </span>
          )}
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${STATUS_COLOR[deliveryOrder.status]}`}>
            {STATUS_LABEL[deliveryOrder.status]}
          </span>
        </div>
      </div>

      {/* أمر تحميل معلّق — مطابقة استلام */}
      {deliveryOrder.status === 'PENDING' && (
        <div className={`bg-white rounded-xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-3 ${deliveryOrder.preparedAt ? 'ring-2 ring-orange-200' : 'ring-2 ring-amber-100'}`}>
          {deliveryOrder.preparedAt ? (
            <>
              <div>
                <p className="font-bold text-orange-700 flex items-center gap-2"><FileCheck2 className="w-5 h-5" /> مستني تأكيد استلام المندوب</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  المخزن جهّز الأصناف{deliveryOrder.preparedBy?.name ? ` (${deliveryOrder.preparedBy.name})` : ''} — لما المندوب يأكّد الاستلام تخرج البضاعة من المخزن وتتحرك العربية.
                </p>
              </div>
              <ReceiptConfirm orderId={deliveryOrder.id} />
            </>
          ) : (
            <div>
              <p className="font-bold text-amber-700 flex items-center gap-2"><FileCheck2 className="w-5 h-5" /> لسه المخزن بيجهّز الأصناف</p>
              <p className="text-xs text-gray-500 mt-0.5">مستني أمين المخزن يأكّد التجهيز الأول، وبعدها يظهر زرار تأكيد الاستلام.</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          {/* الأصناف المحمّلة */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-5 pb-3">
              <Package className="w-5 h-5 text-[#0f3460]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">الأصناف المحمّلة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                    <th className="p-3 font-medium">الصنف</th>
                    <th className="p-3 font-medium">المحمّل</th>
                    <th className="p-3 font-medium">المسلّم</th>
                    <th className="p-3 font-medium">المتبقي على العربية</th>
                  </tr>
                </thead>
                <tbody>
                  {remaining.map((item) => (
                    <tr key={item.productId} className="border-b border-gray-50 last:border-0">
                      <td className="p-3 font-semibold">{item.productName}</td>
                      <td className="p-3 tabular-nums">{item.loaded} {item.unit}</td>
                      <td className="p-3 tabular-nums text-green-700">{item.delivered} {item.unit}</td>
                      <td className="p-3 tabular-nums font-bold">{item.remaining} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* سجل التسليمات */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-[#e94560]" />
              <h3 className="text-base font-bold text-[#1a1a2e]">سجل التسليمات ({deliveryOrder.invoices.length})</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">محصّل كاش</p>
                <p className="font-bold text-green-600 tabular-nums">{(cashTotal - instapayTotal - walletTotal).toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">إنستا باي</p>
                <p className="font-bold text-purple-700 tabular-nums">{instapayTotal.toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">محفظة</p>
                <p className="font-bold text-blue-700 tabular-nums">{walletTotal.toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">آجل</p>
                <p className="font-bold text-yellow-700 tabular-nums">{creditTotal.toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">مرتجعات</p>
                <p className="font-bold text-orange-600 tabular-nums">{returnsTotal.toLocaleString('ar-EG')} ج.م</p>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {deliveryOrder.invoices.length === 0 && (
                <p className="text-sm text-gray-500 py-2">لسه مفيش تسليمات مسجّلة.</p>
              )}
              {deliveryOrder.invoices.map((inv) => {
                const bonusItems = inv.items.filter((it) => it.isBonus)
                return (
                <div key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{inv.customer.name}</p>
                    <p className="text-xs text-gray-400 tabular-nums">{inv.invoiceNo}</p>
                    {bonusItems.map((b) => (
                      <p key={b.id} className="text-[11px] text-amber-700 flex items-center gap-1 mt-0.5">
                        🎁 هدية: {Number(b.quantity)} {b.product.unit} {b.product.name}
                      </p>
                    ))}
                    {inv.invoiceNotes && <p className="text-[11px] text-gray-500 mt-0.5">📝 {inv.invoiceNotes}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <p className="font-semibold text-sm tabular-nums">{Number(inv.netAmount).toLocaleString('ar-EG')} ج.م</p>
                      <p className="text-xs text-gray-400">{inv.paymentMethod}{inv.collectionMethod === 'تحويل انستا' ? ' — إنستا باي' : inv.collectionMethod === 'تحويل محفظة' ? ' — محفظة' : ''}</p>
                      {Number(inv.netAmount) - Number(inv.paidAmount) > 0 && inv.paymentMethod === 'نقدي جزئي' && (
                        <p className="text-[10px] text-yellow-700">باقي {(Number(inv.netAmount) - Number(inv.paidAmount)).toLocaleString('ar-EG')}</p>
                      )}
                    </div>
                    <Link
                      href={`/print/invoice/${inv.id}`}
                      className="p-2 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg"
                      aria-label="طباعة الفاتورة"
                    >
                      <Printer className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
                )
              })}
            </div>
          </div>

          {/* ملخص توريدات فروع كبار الموردين */}
          {deliveryOrder.keyAccountSupplies.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-[#1a1a2e]">توريدات فروع كبار الموردين</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-right border-y border-gray-100 bg-gray-50/50">
                      <th className="p-3 font-medium">الفرع</th>
                      <th className="p-3 font-medium">العميل (المقر)</th>
                      <th className="p-3 font-medium">إجمالي القطع</th>
                      <th className="p-3 font-medium">قيمة المطالبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchSummary.map((b, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="p-3 font-semibold">{b.branch}</td>
                        <td className="p-3 text-gray-500">{b.account}</td>
                        <td className="p-3 tabular-nums">{b.qty}</td>
                        <td className="p-3 tabular-nums font-bold text-amber-700">{b.net.toLocaleString('ar-EG')} ج.م</td>
                      </tr>
                    ))}
                    <tr className="bg-amber-50/50 font-bold">
                      <td className="p-3" colSpan={2}>الإجمالي (مطالبة على المقر)</td>
                      <td className="p-3 tabular-nums">{branchSummary.reduce((s, b) => s + b.qty, 0)}</td>
                      <td className="p-3 tabular-nums text-amber-700">{branchSummary.reduce((s, b) => s + b.net, 0).toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* المرتجعات من العملاء */}
          {deliveryOrder.returns.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Undo2 className="w-5 h-5 text-orange-500" />
                <h3 className="text-base font-bold text-[#1a1a2e]">المرتجعات من العملاء ({deliveryOrder.returns.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {deliveryOrder.returns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{r.customer?.name || r.customerName || 'عميل'}</p>
                      <p className="text-[11px] text-gray-400">
                        {r.returnNo} · {r.items.map((it) => `${it.product.name} ×${Number(it.quantity)}`).join('، ')} · {r.refundCash ? 'رد نقدي' : 'خصم آجل'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-sm text-orange-600 tabular-nums">{Number(r.totalValue).toLocaleString('ar-EG')} ج.م</span>
                      <Link href={`/print/return/${r.id}`} className="p-2 text-gray-400 hover:text-[#0f3460] hover:bg-gray-100 rounded-lg" aria-label="طباعة إشعار المرتجع">
                        <Printer className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {deliveryOrder.status === 'IN_PROGRESS' && (
            <>
              {/* روابط سريعة بين أقسام الجولة والشاشات المنفصلة */}
              <div className="flex flex-wrap gap-2">
                <a href="#deliver" className="flex-1 min-w-max text-center bg-[#0f3460] text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#0a2545]">تنزيل بضاعة</a>
                <Link href="/drivers/returns" className="flex-1 min-w-max text-center bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-orange-600">مرتجع</Link>
                <Link href="/drivers/collections" className="flex-1 min-w-max text-center bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700">تحصيل</Link>
                <a href="#settle" className="flex-1 min-w-max text-center bg-[#e94560] text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#c73e54]">تسوية اليوم</a>
              </div>
              <div id="deliver" style={{ scrollMarginTop: 90 }}>
                <DeliverForm
                  deliveryOrderId={deliveryOrder.id}
                  customers={customersLite}
                  remainingItems={remaining}
                  rewardRules={rewardRulesLite}
                  delegateArea={delegateArea}
                />
              </div>
              <div id="settle" style={{ scrollMarginTop: 90 }}>
                <SettleForm deliveryOrderId={deliveryOrder.id} remainingItems={remaining} />
              </div>
            </>
          )}

          {deliveryOrder.settlement && (
            <div className="bg-white p-5 rounded-xl shadow-sm space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <FileCheck2 className="w-5 h-5 text-green-600" />
                <h3 className="text-base font-bold text-[#1a1a2e]">ملخص التسوية</h3>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">محمّل على العربية</span>
                <span className="font-semibold tabular-nums">{deliveryOrder.items.reduce((s, it) => s + Number(it.quantity), 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">المباع</span>
                <span className="font-semibold tabular-nums">{Number(deliveryOrder.settlement.soldQty)}</span>
              </div>
              {Number(deliveryOrder.settlement.bonusQty) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">🎁 هدايا/بونص</span>
                  <span className="font-semibold text-amber-700 tabular-nums">{Number(deliveryOrder.settlement.bonusQty)}</span>
                </div>
              )}
              {(() => {
                const customerReturnTotal = deliveryOrder.returns
                  .flatMap((r) => r.items)
                  .reduce((s, it) => s + Number(it.quantity), 0)
                const leftoverTotal = Math.max(0, Number(deliveryOrder.settlement!.returnedQty) - customerReturnTotal)
                return customerReturnTotal > 0 ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">باقي على العربية (بواقي بيع)</span>
                      <span className="font-semibold tabular-nums">{leftoverTotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">مرتجع من عميل (فاتورة سابقة)</span>
                      <span className="font-semibold text-orange-600 tabular-nums">{customerReturnTotal}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-dashed border-gray-100 pt-1.5">
                      <span className="text-gray-500">إجمالي المرتجع</span>
                      <span className="font-semibold tabular-nums">{Number(deliveryOrder.settlement!.returnedQty)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">المرتجع</span>
                    <span className="font-semibold tabular-nums">{Number(deliveryOrder.settlement!.returnedQty)}</span>
                  </div>
                )
              })()}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">محصّل كاش</span>
                <span className="font-semibold tabular-nums">{Number(deliveryOrder.settlement.cashOnlyAmount).toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">إنستا باي</span>
                <span className="font-semibold text-purple-700 tabular-nums">{Number(deliveryOrder.settlement.instapayAmount).toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">محفظة</span>
                <span className="font-semibold text-blue-700 tabular-nums">{Number(deliveryOrder.settlement.walletAmount).toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">إجمالي المحصّل</span>
                <span className="font-semibold tabular-nums">{Number(deliveryOrder.settlement.cashAmount).toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">آجل</span>
                <span className="font-semibold tabular-nums">{Number(deliveryOrder.settlement.creditAmount).toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="text-gray-500">عمولة المندوب</span>
                <span className="font-semibold text-[#e94560] tabular-nums">
                  {Number(deliveryOrder.settlement.commission).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
