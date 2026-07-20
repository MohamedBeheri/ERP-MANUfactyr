import type { Metadata } from 'next'
import { getStoreSettings } from '@/lib/store'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings().catch(() => null)
  return {
    title: s?.storeName || 'متجر البدر للبن',
    description: s?.tagline || 'قهوة طازجة',
    icons: { icon: '/logo-header.png' },
  }
}

export const dynamic = 'force-dynamic'

// المتجر ليه ثيم داكن خاص بيه (زي soopadel) — مش داشبورد
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#0a0a0b] text-white">{children}</div>
}
