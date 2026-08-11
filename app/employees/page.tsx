import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserManager } from '@/components/user-manager'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, username: true, role: true, permissions: true, status: true, lastLogin: true, createdAt: true, phone: true, email: true, jobTitle: true, nationalId: true, address: true, hireDate: true, avatarUrl: true, notes: true, commissionRate: true, monthlyTarget: true },
  })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">الموظفين</h1>
        <p className="text-sm text-gray-500 mt-0.5">بيانات كل موظف الشخصية والوظيفية — الصلاحيات بتتبع الدور الوظيفي تلقائيًا، مع إمكانية تخصيصها لو احتجت</p>
      </div>

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
