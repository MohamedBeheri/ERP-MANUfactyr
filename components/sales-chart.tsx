'use client'

import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

export function SalesChart({ data }: { data: { date: string; total: number }[] }) {
  const chartData = {
    labels: data.map(d => new Date(d.date).toLocaleDateString('ar-EG')),
    datasets: [{
      label: 'المبيعات',
      data: data.map(d => d.total),
      borderColor: '#e94560',
      backgroundColor: 'rgba(233, 69, 96, 0.1)',
      tension: 0.4,
      fill: true,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">📈 المبيعات</h3>
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
