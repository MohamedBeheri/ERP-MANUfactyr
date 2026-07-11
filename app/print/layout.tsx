import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { PrintTopBar } from '@/components/print-top-bar'

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <div className="min-h-dvh bg-gray-100 print:bg-white">
      <PrintTopBar />
      <div className="py-8 px-4 print:p-0">{children}</div>
    </div>
  )
}
