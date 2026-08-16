import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DelegateTargetPanel } from '@/components/delegate-target-panel'

export const dynamic = 'force-dynamic'

export default async function MyTargetPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')
  const delegate = await prisma.delegate.findFirst({ where: { userId: session.user.id, isActive: true }, select: { id: true, name: true } })
  if (!delegate) redirect('/drivers')

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">تارجتي</h1>
        <p className="text-sm text-gray-500 mt-0.5">متابعة إنجازك الشهري مقابل التارجت المحدّد لك</p>
      </div>
      <DelegateTargetPanel delegateId={delegate.id} isAdmin={false} />
    </div>
  )
}
