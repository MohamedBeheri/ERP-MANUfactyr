interface Activity {
  id: string
  action: string
  description: string
  impact: string
  createdAt: Date
  user: { name: string }
}

export function RecentActivity({ activities }: { activities: Activity[] }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">أحدث النشاطات</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
            <div className="w-2 h-2 rounded-full bg-[#e94560] mt-2 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-700">{activity.description}</p>
              <div className="flex gap-2 mt-1 text-xs text-gray-400">
                <span>{activity.user.name}</span>
                <span>•</span>
                <span>{new Date(activity.createdAt).toLocaleString('ar-EG')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
