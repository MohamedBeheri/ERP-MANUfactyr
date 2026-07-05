import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={session?.user} />
      <main className="flex-1 mr-72">
        <div className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-[#1a1a2e]">Golden Coffee ERP</h2>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">🖨️ طباعة</button>
            <button className="px-4 py-2 bg-[#0f3460] text-white rounded-lg text-sm hover:bg-[#0a2545]">📥 تصدير</button>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
