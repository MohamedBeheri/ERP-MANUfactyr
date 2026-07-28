'use client'

import { SessionProvider } from 'next-auth/react'
import { SplashScreen } from './splash-screen'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SplashScreen />
      {children}
    </SessionProvider>
  )
}
