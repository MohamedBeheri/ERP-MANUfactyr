import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DashboardShell } from '@/components/dashboard-shell'

export async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return <DashboardShell user={session?.user}>{children}</DashboardShell>
}
