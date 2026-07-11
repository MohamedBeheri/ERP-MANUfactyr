import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function GovernancePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [auditLogs, users] = await Promise.all([
    prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, username: true, role: true, status: true, lastLogin: true, createdAt: true },
    }),
  ])

  const ROLE_LABEL: Record<string, string> = {
    ADMIN: 'مدير النظام',
    FACTORY: 'مدير المصنع',
    WAREHOUSE: 'مدير المخزن',
    SALES: 'مدير المبيعات',
    ACCOUNTANT: 'محاسب',
    DELEGATE: 'مندوب',
  }

  const STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'نشط',
    INACTIVE: 'غير نشط',
    SUSPENDED: 'موقوف',
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a2e]">🛡️ الحوكمة</h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">👥 المستخدمين</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b border-gray-100">
                <th className="p-3">الاسم</th>
                <th className="p-3">اسم المستخدم</th>
                <th className="p-3">الدور</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-semibold">{u.name}</td>
                  <td className="p-3 text-gray-500">{u.username}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-600">
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${u.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {STATUS_LABEL[u.status] || u.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">📜 سجل المراجعة</h3>
        <div className="divide-y divide-gray-100">
          {auditLogs.length === 0 && <p className="p-6 text-sm text-gray-500">مفيش عمليات مسجّلة.</p>}
          {auditLogs.map((log) => (
            <div key={log.id} className="p-4 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-600">{log.action}</span>
                  <span className="text-sm font-semibold text-[#1a1a2e]">{log.user.name}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{log.description}</p>
                <p className="text-xs text-gray-400 mt-1">التأثير: {log.impact}</p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString('ar-EG')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
