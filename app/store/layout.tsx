import type { Metadata } from 'next'
import { Cairo, Tajawal } from 'next/font/google'
import { getStoreSettings } from '@/lib/store'

const cairo = Cairo({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700', '900'], variable: '--font-cairo' })
const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['400', '500', '700', '800'], variable: '--font-tajawal' })

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings().catch(() => null)
  return {
    title: s?.storeName || 'شركة البدر لتجارة البن',
    description: s?.tagline || 'قهوة طازجة',
    icons: { icon: '/logo-header.png' },
  }
}

export const dynamic = 'force-dynamic'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await getStoreSettings().catch(() => null)
  const light = s?.bgTheme === 'light'
  const fontVar = s?.fontFamily === 'Tajawal' ? 'var(--font-tajawal)' : 'var(--font-cairo)'
  return (
    <div
      className={`${cairo.variable} ${tajawal.variable} min-h-dvh ${light ? 'bg-[#f5f1ea] text-[#1a1512]' : 'bg-[#0a0a0b] text-white'}`}
      style={{ fontFamily: fontVar }}
    >
      {children}
    </div>
  )
}
