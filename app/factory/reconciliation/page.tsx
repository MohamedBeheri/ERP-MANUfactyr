import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { ReconciliationReport } from '@/components/reconciliation-report'

export const dynamic = 'force-dynamic'

export default async function ReconciliationPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/factory" className="p-2 text-gray-400 hover:text-[#1a1a2e] hover:bg-gray-100 rounded-lg" aria-label="رجوع">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">محضر التشغيل (المطابقة)</h1>
          <p className="text-sm text-gray-500 mt-0.5">المطلوب بالوصفة مقابل الفعلي من المصنع = عجز/زيادة ونسبة الهدر، لكل قناة</p>
        </div>
      </div>
      <ReconciliationReport />
    </div>
  )
}
