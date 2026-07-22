import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { CatalogManager } from '@/components/catalog-manager'

export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">بنك الأصناف</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          هيكل المصنع الكامل: البن الأخضر، العطارة، النكهات، التوليفات ووصفاتها، مواد التغليف، والمنتجات النهائية
        </p>
      </div>
      <CatalogManager />
    </div>
  )
}
