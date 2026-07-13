import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintDoc, PrintTable } from '@/components/print-doc'

export default async function ProductionPrintPage({ params }: { params: { id: string } }) {
  const prod = await prisma.production.findUnique({
    where: { id: params.id },
    include: {
      inputs: { include: { product: true } },
      items: { include: { product: true } },
      rawProduct: true,
      recipe: true,
      creator: true,
    },
  })
  if (!prod) notFound()

  const lineLabel = prod.lineType === 'ROASTING' ? 'خط التحميص' : 'خط الخلط والطحن والتعبئة'

  return (
    <PrintDoc
      title="بطاقة تشغيلة تصنيع"
      docNo={prod.orderNo}
      date={prod.createdAt}
      meta={[
        { label: 'خط الإنتاج', value: lineLabel },
        { label: 'المرحلة', value: prod.stage },
        ...(prod.batchNo ? [{ label: 'رقم التشغيلة (Lot)', value: prod.batchNo }] : []),
        ...(prod.roastLevel ? [{ label: 'درجة التحميص', value: prod.roastLevel }] : []),
        ...(prod.grindType ? [{ label: 'درجة الطحن', value: prod.grindType }] : []),
        ...(prod.recipe ? [{ label: 'الوصفة', value: prod.recipe.name }] : []),
        ...(prod.expiryDate
          ? [{ label: 'تاريخ الصلاحية', value: new Date(prod.expiryDate).toLocaleDateString('ar-EG') }]
          : []),
        { label: 'تكلفة التشغيل', value: `${Number(prod.opCost).toLocaleString('ar-EG')} ج.م` },
        { label: 'أمر بواسطة', value: prod.creator.name },
      ]}
      footerNote={prod.notes ? `ملاحظات: ${prod.notes}` : undefined}
      signatures={['مشرف الإنتاج', 'مراقب الجودة', 'أمين المخزن']}
    >
      {/* المدخلات */}
      <h4 className="font-bold text-sm mb-2">المدخلات (الخامات)</h4>
      <PrintTable
        headers={['#', 'الخامة', 'الكمية', 'النسبة في الخلطة']}
        rows={prod.inputs.map((inp, i) => [
          i + 1,
          inp.product.name,
          `${inp.quantity} ${inp.product.unit}`,
          Number(inp.percentage) > 0 ? `${Number(inp.percentage)}%` : '—',
        ])}
      />

      {/* المخرجات */}
      <h4 className="font-bold text-sm mb-2 mt-6">المخرجات (المنتج الناتج)</h4>
      <PrintTable
        headers={['#', 'المنتج', 'الكمية', 'الوحدة']}
        rows={prod.items.map((item, i) => [i + 1, item.product.name, item.quantity, item.product.unit])}
      />

      {/* ميزان الوزن والهدر */}
      <div className="mt-6">
        <PrintTable
          headers={['البيان', 'القيمة']}
          rows={[
            ['إجمالي وزن المدخلات', `${prod.inputWeight}`],
            ['إجمالي وزن المخرجات', `${prod.outputWeight}`],
            ['الهدر (Yield Loss)', `${prod.wasteWeight}`],
          ]}
          totals={[{ label: 'نسبة الهدر', value: `${Number(prod.wastePercent).toFixed(2)}%` }]}
        />
      </div>
    </PrintDoc>
  )
}
