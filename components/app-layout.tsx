import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'

export async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <div className="flex min-h-dvh bg-gray-50">
      <Sidebar user={session?.user} />
      <main className="flex-1 mr-64 min-w-0">{children}</main>
    </div>
  )
}
