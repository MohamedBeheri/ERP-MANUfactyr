import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ExportButtons } from '@/components/export-buttons'
import { UserManager } from '@/components/user-manager'

export const dynamic = 'force-dynamic'

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
      select: { id: true, name: true, username: true, role: true, permissions: true, status: true, lastLogin: true, createdAt: true },
    }),
  ])

  const auditRows = auditLogs.map((log) => [
    log.action,
    log.user.name,
    log.description,
    log.impact,
    new Date(log.createdAt).toLocaleString('ar-EG'),
  ])

  return (
    <div className="p-6 space-y-6 print-area">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">الحوكمة</h1>
        <ExportButtons
          fileName="سجل-المراجعة"
          headers={['العملية', 'المستخدم', 'الوصف', 'التأثير', 'التاريخ']}
          rows={auditRows}
        />
      </div>

      <div className="no-print">
        <UserManager
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role,
            permissions: u.permissions,
            status: u.status,
            lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
          }))}
          currentUserId={session.user.id}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-[#1a1a2e] p-6 pb-3">سجل المراجعة</h3>
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
