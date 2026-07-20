import type { Metadata } from 'next'
import { getStoreSettings } from '@/lib/store'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings().catch(() => null)
  return {
    title: s?.storeName || 'متجر البدر للبن',
    description: s?.tagline || 'قهوة طازجة',
  }
}

export const dynamic = 'force-dynamic'

// المتجر ليه ثيم خاص بيه — مش داشبورد
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f7f3ee] text-[#1a1a2e]">{children}</div>
}
