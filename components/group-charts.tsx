'use client'

import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const egp = (n: number) => `${n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`

// رسم خطي عام لمقارنة سلسلتين عبر الزمن — عناوين قابلة للتخصيص
export function TrendLineChart({ title, subtitle, labels, primary, secondary }: {
  title: string
  subtitle?: string
  labels: string[]
  primary: { label: string; data: number[]; color: string }
  secondary?: { label: string; data: number[]; color: string }
}) {
  const datasets = [
    { label: primary.label, data: primary.data, borderColor: primary.color, backgroundColor: primary.color + '22', fill: true, tension: 0.35, pointRadius: 2 },
    ...(secondary ? [{ label: secondary.label, data: secondary.data, borderColor: secondary.color, backgroundColor: secondary.color + '22', fill: true, tension: 0.35, pointRadius: 2 }] : []),
  ]
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#1a1a2e] mb-0.5">{title}</h3>
      {subtitle && <p className="text-[11px] text-gray-400 mb-4">{subtitle}</p>}
      <div className="h-60">
        <Line
          data={{ labels, datasets }}
          options={{
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: !!secondary, labels: { font: { family: 'Cairo' }, boxWidth: 12 } },
              tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${egp(c.parsed.y)}` } },
            },
            scales: {
              x: { ticks: { font: { family: 'Cairo', size: 10 } }, grid: { display: false } },
              y: { ticks: { callback: (v: any) => Number(v).toLocaleString('ar-EG'), font: { family: 'Cairo' } }, grid: { color: '#f1f1f1' } },
            },
          }}
        />
      </div>
    </div>
  )
}

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
        <div className="min-h-[200px] flex items-center justify-center">
          <p className="text-center text-gray-400 text-sm">{emptyText}</p>
        </div>
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
