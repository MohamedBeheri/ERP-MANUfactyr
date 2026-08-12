'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`

// رسم أعمدة أفقي عام للوحات التحكم — بيعرض قائمة (اسم + قيمة) مرتّبة
export function GroupBarChart({ title, subtitle, items, color = '#0f3460', emptyText = 'لا توجد بيانات', money = true }: {
  title: string
  subtitle?: string
  items: { label: string; value: number }[]
  color?: string
  emptyText?: string
  money?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-0.5">{title}</h3>
      {subtitle && <p className="text-[11px] text-gray-400 mb-4">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="py-12 text-center text-gray-400 text-sm">{emptyText}</p>
      ) : (
        <div style={{ height: Math.max(200, items.length * 38) }}>
          <Bar
            data={{
              labels: items.map((i) => i.label),
              datasets: [{ data: items.map((i) => i.value), backgroundColor: color, borderRadius: 6, barThickness: 20 }],
            }}
            options={{
              indexAxis: 'y' as const,
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c: any) => (money ? egp(c.parsed.x) : c.parsed.x.toLocaleString('ar-EG')) } },
              },
              scales: {
                x: { ticks: { callback: (v: any) => (money ? Number(v).toLocaleString('ar-EG') : v), font: { family: 'Cairo' } }, grid: { color: '#f1f1f1' } },
                y: { ticks: { font: { family: 'Cairo', size: 11 } }, grid: { display: false } },
              },
            }}
          />
        </div>
      )}
    </div>
  )
}
