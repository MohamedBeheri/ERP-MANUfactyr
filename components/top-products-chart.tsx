'use client'

import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export function TopProductsChart({ labels, values }: { labels: string[]; values: number[] }) {
  const data = {
    labels,
    datasets: [
      {
        label: 'الكمية المباعة',
        data: values,
        backgroundColor: ['#0f3460', '#e94560', '#16a34a', '#eab308', '#7c3aed'],
        borderRadius: 6,
        maxBarThickness: 42,
      },
    ],
  }

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { rtl: true } },
    scales: {
      x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
      y: { grid: { display: false } },
    },
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-base font-bold text-[#1a1a2e] mb-4">الأكثر مبيعًا (بالكمية)</h3>
      <div className="h-64">
        {values.length === 0 ? (
          <p className="text-sm text-gray-500 h-full flex items-center justify-center">مفيش مبيعات في الفترة دي.</p>
        ) : (
          <Bar data={data} options={options} />
        )}
      </div>
    </div>
  )
}

export function PaymentSplitChart({ cash, credit }: { cash: number; credit: number }) {
  const data = {
    labels: ['نقدي', 'آجل'],
    datasets: [
      {
        data: [cash, credit],
        backgroundColor: ['#16a34a', '#eab308'],
        borderWidth: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom' as const, rtl: true },
      tooltip: {
        rtl: true,
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${Number(ctx.parsed).toLocaleString('ar-EG')} ج.م`,
        },
      },
    },
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-base font-bold text-[#1a1a2e] mb-4">نقدي مقابل آجل</h3>
      <div className="h-64">
        {cash === 0 && credit === 0 ? (
          <p className="text-sm text-gray-500 h-full flex items-center justify-center">مفيش تحصيلات في الفترة دي.</p>
        ) : (
          <Doughnut data={data} options={options} />
        )}
      </div>
    </div>
  )
}
