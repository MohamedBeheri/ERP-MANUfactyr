'use client'

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export function SalesChart({ labels, values, title }: { labels: string[]; values: number[]; title: string }) {
  const chartData = {
    labels,
    datasets: [
      {
        label: 'المبيعات (ج.م)',
        data: values,
        borderColor: '#e94560',
        backgroundColor: 'rgba(233, 69, 96, 0.08)',
        pointBackgroundColor: '#e94560',
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        rtl: true,
        callbacks: {
          label: (ctx: any) => ` ${Number(ctx.parsed.y).toLocaleString('ar-EG')} ج.م`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { callback: (v: any) => Number(v).toLocaleString('ar-EG') },
      },
      x: { grid: { display: false } },
    },
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-base font-bold text-[#1a1a2e] mb-4">{title}</h3>
      <div className="h-72">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
