import type { Metadata } from 'next'
import './globals.css'
import './cairo.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'شركة البدر لتجارة البن',
  description: 'نظام إدارة شركة البدر لتجارة البن — Al Badr Coffee ERP',
  icons: { icon: '/logo-header.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-cairo">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
