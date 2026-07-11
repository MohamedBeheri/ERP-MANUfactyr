import Link from 'next/link'

const PERIODS = [
  { days: 1, label: 'اليوم' },
  { days: 7, label: '7 أيام' },
  { days: 14, label: '14 يوم' },
  { days: 30, label: '30 يوم' },
]

export function PeriodSelector({ current, basePath }: { current: number; basePath: string }) {
  return (
    <div className="no-print inline-flex bg-white rounded-lg shadow-sm p-1 gap-1">
      {PERIODS.map((p) => (
        <Link
          key={p.days}
          href={`${basePath}?days=${p.days}`}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            current === p.days
              ? 'bg-[#1a1a2e] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  )
}
