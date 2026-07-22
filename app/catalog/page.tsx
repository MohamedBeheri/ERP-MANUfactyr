import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { CatalogManager } from '@/components/catalog-manager'

export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">بنك الأصناف</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            هيكل المصنع الكامل: البن الأخضر، العطارة، النكهات، التوليفات ووصفاتها، مواد التغليف، والمنتجات النهائية
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-white ring-1 ring-gray-200 text-[#0f3460] rounded-lg text-sm font-semibold hover:bg-gray-50 shrink-0"
        >
          <LayoutDashboard className="w-4 h-4" /> لوحة التحكم
        </Link>
      </div>
      <CatalogManager />
    </div>
  )
}
