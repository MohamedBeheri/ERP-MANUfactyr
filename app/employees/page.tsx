import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserManager } from '@/components/user-manager'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const [users, openCustodies] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, username: true, role: true, permissions: true, status: true, lastLogin: true, createdAt: true, phone: true, email: true, jobTitle: true, nationalId: true, address: true, hireDate: true, avatarUrl: true, notes: true, commissionRate: true, monthlyTarget: true },
    }),
    prisma.custody.findMany({
      where: { status: { in: ['PENDING', 'APPROVED', 'DISBURSED'] } },
      include: { user: { select: { name: true } }, expenses: { where: { status: 'APPROVED' } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">الموظفين</h1>
        <p className="text-sm text-gray-500 mt-0.5">بيانات كل موظف الشخصية والوظيفية — الصلاحيات بتتبع الدور الوظيفي تلقائيًا، مع إمكانية تخصيصها لو احتجت</p>
      </div>

      {openCustodies.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-base font-bold text-[#1a1a2e] mb-3">عُهد مفتوحة على الموظفين ({openCustodies.length})</h3>
          <div className="flex flex-wrap gap-2">
            {openCustodies.map((c) => {
              const spent = c.expenses.reduce((s, e) => s + Number(e.amount), 0)
              const inHand = Number(c.approvedAmount ?? c.requestedAmount) - spent
              const label = c.status === 'PENDING' ? 'بانتظار الاعتماد' : c.status === 'APPROVED' ? 'بانتظار الصرف' : `في العهدة ${inHand.toLocaleString('ar-EG')} ج.م`
              const cls = c.status === 'DISBURSED' ? 'bg-orange-50 text-orange-700' : 'bg-yellow-50 text-yellow-700'
              return (
                <span key={c.id} className={`text-xs px-3 py-1.5 rounded-lg font-semibold tabular-nums ${cls}`}>
                  {c.user.name} · {c.custodyNo} — {label}
                </span>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">إدارة العُهد بالكامل (اعتماد/صرف/تسوية) من شاشة الخزنة ← تبويب عُهد الموظفين.</p>
        </div>
      )}

      <UserManager
        users={users.map((u) => ({
          id: u.id, name: u.name, username: u.username, role: u.role,
          permissions: u.permissions, status: u.status,
          lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
          phone: u.phone, email: u.email, jobTitle: u.jobTitle,
          nationalId: u.nationalId, address: u.address,
          hireDate: u.hireDate ? u.hireDate.toISOString() : null,
          commissionRate: Number(u.commissionRate),
          monthlyTarget: Number(u.monthlyTarget),
          avatarUrl: u.avatarUrl, notes: u.notes,
        }))}
        currentUserId={session.user.id}
      />
    </div>
  )
}
