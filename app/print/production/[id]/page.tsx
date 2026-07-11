import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function ProductionPrintPage({ params }: { params: { id: string } }) {
  const prod = await prisma.production.findUnique({
    where: { id: params.id },
    include: { items: { include: { product: true } }, rawProduct: true, creator: true },
  })
  if (!prod) notFound()

  return (
    <PrintDoc
      title="أمر تصنيع"
      docNo={prod.orderNo}
      date={prod.createdAt}
      meta={[
        { label: 'الخامة المستخدمة', value: prod.rawProduct ? prod.rawProduct.name : '—' },
        { label: 'كمية الخام', value: `${prod.rawUsed} ${prod.rawProduct?.unit || 'كجم'}` },
        { label: 'المرحلة', value: prod.stage },
        { label: 'تكلفة التشغيل', value: `${Number(prod.opCost).toLocaleString('ar-EG')} ج.م` },
        { label: 'أمر بواسطة', value: prod.creator.name },
        { label: 'الحالة', value: prod.status === 'COMPLETED' ? 'منفّذ' : prod.status },
      ]}
      footerNote={prod.notes ? `ملاحظات: ${prod.notes}` : undefined}
      signatures={['مدير المصنع', 'أمين المخزن', 'المدير العام']}
    >
      <PrintTable
        headers={['#', 'المنتج الناتج', 'الكمية', 'الوحدة']}
        rows={prod.items.map((item, i) => [i + 1, item.product.name, item.quantity, item.product.unit])}
        totals={[
          { label: 'إجمالي الوحدات المنتجة', value: `${prod.items.reduce((s, i) => s + i.quantity, 0)}` },
        ]}
      />
    </PrintDoc>
  )
}
