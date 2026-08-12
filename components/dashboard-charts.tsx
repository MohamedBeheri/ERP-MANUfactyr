'use client'

import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`

/* ─── خط المبيعات مع المقارنة ─── */
export function SalesTrendChart({ labels, sales, expenses, title }: {
  labels: string[]; sales: number[]; expenses: number[]; title: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-1">{title}</h3>
      <p className="text-[11px] text-gray-400 mb-4">المبيعات مقابل المصروفات</p>
      <div className="h-72">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: 'المبيعات',
                data: sales,
                borderColor: '#0f3460',
                backgroundColor: 'rgba(15, 52, 96, 0.06)',
                pointBackgroundColor: '#0f3460',
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.4,
                fill: true,
                borderWidth: 2.5,
              },
              {
                label: 'المصروفات',
                data: expenses,
                borderColor: '#e94560',
                backgroundColor: 'rgba(233, 69, 96, 0.04)',
                pointBackgroundColor: '#e94560',
                pointRadius: 2,
                pointHoverRadius: 5,
                tension: 0.4,
                fill: true,
                borderWidth: 2,
                borderDash: [6, 3],
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } },
              tooltip: { rtl: true, callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${egp(ctx.parsed.y)}` } },
            },
            scales: {
              y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => egp(Number(v)), font: { size: 10 } } },
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            },
          }}
        />
      </div>
    </div>
  )
}

/* ─── توزيع الإيراد: نقدي / آجل / كبار الموردين ─── */
export function RevenueBreakdownChart({ cash, credit, ka }: { cash: number; credit: number; ka: number }) {
  const total = cash + credit + ka
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-1">توزيع الإيرادات</h3>
      <p className="text-[11px] text-gray-400 mb-4">نقدي · آجل · كبار الموردين</p>
      <div className="h-56 flex items-center justify-center">
        {total === 0 ? (
          <p className="text-sm text-gray-400">لا توجد إيرادات</p>
        ) : (
          <Doughnut
            data={{
              labels: ['نقدي', 'آجل', 'كبار الموردين'],
              datasets: [{ data: [cash, credit, ka], backgroundColor: ['#16a34a', '#eab308', '#0f3460'], borderWidth: 0 }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '68%',
              plugins: {
                legend: { position: 'bottom', rtl: true, labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                tooltip: { rtl: true, callbacks: { label: (ctx: any) => ` ${ctx.label}: ${egp(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(0)}%)` } },
              },
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ─── دائرة توزيع المحصّل بوسيلة الدفع (كاش/إنستا/محفظة/فيزا-شبكة) ─── */
export function PaymentMethodsPie({ cash, insta, wallet, network }: { cash: number; insta: number; wallet: number; network: number }) {
  const total = cash + insta + wallet + network
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-1">حجم الفلوس بوسيلة الدفع</h3>
      <p className="text-[11px] text-gray-400 mb-4">كاش · إنستا باي · محفظة · فيزا/شبكة</p>
      <div className="h-56 flex items-center justify-center">
        {total === 0 ? (
          <p className="text-sm text-gray-400">لا توجد تحصيلات</p>
        ) : (
          <Doughnut
            data={{
              labels: ['كاش', 'إنستا باي', 'محفظة', 'فيزا/شبكة'],
              datasets: [{ data: [cash, insta, wallet, network], backgroundColor: ['#16a34a', '#7c3aed', '#2563eb', '#0d9488'], borderWidth: 0 }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '58%',
              plugins: {
                legend: { position: 'bottom', rtl: true, labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                tooltip: { rtl: true, callbacks: { label: (ctx: any) => ` ${ctx.label}: ${egp(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(0)}%)` } },
              },
            }}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {[
          { label: 'كاش', value: cash, cls: 'text-green-700 bg-green-50' },
          { label: 'إنستا باي', value: insta, cls: 'text-purple-700 bg-purple-50' },
          { label: 'محفظة', value: wallet, cls: 'text-blue-700 bg-blue-50' },
          { label: 'فيزا/شبكة', value: network, cls: 'text-teal-700 bg-teal-50' },
        ].map((m) => (
          <div key={m.label} className={`rounded-lg px-2.5 py-1.5 ${m.cls}`}>
            <p className="text-[10px] font-semibold opacity-70">{m.label}</p>
            <p className="text-sm font-black tabular-nums">{egp(m.value)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── أعمدة المنتجات الأكثر مبيعًا ─── */
export function TopProductsBar({ items }: { items: { name: string; qty: number; revenue: number }[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-1">الأكثر مبيعًا</h3>
      <p className="text-[11px] text-gray-400 mb-4">بالكمية والإيراد</p>
      <div className="h-64">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 h-full flex items-center justify-center">لا توجد مبيعات</p>
        ) : (
          <Bar
            data={{
              labels: items.map(i => i.name),
              datasets: [
                { label: 'الكمية', data: items.map(i => i.qty), backgroundColor: '#0f3460', borderRadius: 4, maxBarThickness: 28, yAxisID: 'y' },
                { label: 'الإيراد', data: items.map(i => i.revenue), backgroundColor: '#e9b44c', borderRadius: 4, maxBarThickness: 28, yAxisID: 'y1' },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 10 } } },
                tooltip: { rtl: true },
              },
              scales: {
                y: { type: 'linear', position: 'right', grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } }, title: { display: true, text: 'كمية', font: { size: 10 } } },
                y1: { type: 'linear', position: 'left', grid: { drawOnChartArea: false }, ticks: { callback: (v: any) => egp(Number(v)), font: { size: 10 } }, title: { display: true, text: 'إيراد', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              },
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ─── أعمدة المصروفات حسب النشاط ─── */
export function ExpensesByCategoryChart({ items }: { items: { name: string; amount: number }[] }) {
  const colors = ['#e94560', '#0f3460', '#eab308', '#7c3aed', '#16a34a', '#f97316', '#06b6d4', '#ec4899']
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-1">المصروفات حسب البند</h3>
      <p className="text-[11px] text-gray-400 mb-4">أعلى البنود إنفاقًا</p>
      <div className="h-64">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 h-full flex items-center justify-center">لا توجد مصروفات</p>
        ) : (
          <Bar
            data={{
              labels: items.map(i => i.name),
              datasets: [{ data: items.map(i => i.amount), backgroundColor: items.map((_, idx) => colors[idx % colors.length]), borderRadius: 6, maxBarThickness: 36 }],
            }}
            options={{
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { rtl: true, callbacks: { label: (ctx: any) => ` ${egp(ctx.parsed.x)}` } } },
              scales: {
                x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => egp(Number(v)), font: { size: 10 } } },
                y: { grid: { display: false }, ticks: { font: { size: 11 } } },
              },
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ─── خط الإنتاج اليومي ─── */
export function ProductionTrendChart({ labels, produced, orders }: { labels: string[]; produced: number[]; orders: number[] }) {
  const isEmpty = produced.every((v) => !v) && orders.every((v) => !v)
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-1">حركة التصنيع</h3>
      <p className="text-[11px] text-gray-400 mb-4">الكمية المنتجة وعدد الأوامر</p>
      {isEmpty ? (
        <p className="h-56 flex items-center justify-center text-center text-gray-400 text-sm">مفيش تشغيلات تصنيع في الفترة دي</p>
      ) : (
      <div className="h-56">
        <Bar
          data={{
            labels,
            datasets: [
              { label: 'وحدات منتجة', data: produced, backgroundColor: 'rgba(15, 52, 96, 0.7)', borderRadius: 4, maxBarThickness: 24, yAxisID: 'y' },
              { label: 'أوامر', data: orders, backgroundColor: 'rgba(233, 180, 76, 0.7)', borderRadius: 4, maxBarThickness: 24, yAxisID: 'y1' },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 10 } } },
              tooltip: { rtl: true },
            },
            scales: {
              y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
              y1: { beginAtZero: true, position: 'left', grid: { drawOnChartArea: false }, ticks: { font: { size: 10 } } },
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            },
          }}
        />
      </div>
      )}
    </div>
  )
}

/* ─── تدفقات نقدية (وارد/منصرف) ─── */
export function CashFlowChart({ labels, inflows, outflows }: { labels: string[]; inflows: number[]; outflows: number[] }) {
  const isEmpty = inflows.every((v) => !v) && outflows.every((v) => !v)
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-1">التدفقات النقدية</h3>
      <p className="text-[11px] text-gray-400 mb-4">الوارد مقابل المنصرف</p>
      {isEmpty ? (
        <p className="h-56 flex items-center justify-center text-center text-gray-400 text-sm">مفيش حركة نقدية في الفترة دي</p>
      ) : (
      <div className="h-56">
        <Bar
          data={{
            labels,
            datasets: [
              { label: 'وارد', data: inflows, backgroundColor: '#16a34a', borderRadius: 4, maxBarThickness: 20 },
              { label: 'منصرف', data: outflows.map(v => -v), backgroundColor: '#e94560', borderRadius: 4, maxBarThickness: 20 },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 10 } } },
              tooltip: { rtl: true, callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${egp(Math.abs(ctx.parsed.y))}` } },
            },
            scales: {
              y: { grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => egp(Math.abs(Number(v))), font: { size: 10 } } },
              x: { grid: { display: false }, stacked: true, ticks: { font: { size: 10 } } },
            },
          }}
        />
      </div>
      )}
    </div>
  )
}
