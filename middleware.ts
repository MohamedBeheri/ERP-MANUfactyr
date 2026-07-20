import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { canAccessPath } from '@/lib/permissions'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname
    const role = token?.role as string
    const permissions = (token as any)?.permissions as string[] | undefined

    if (!canAccessPath(path, role, permissions)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/factory/:path*',
    '/warehouse/:path*',
    '/sales/:path*',
    '/delegates/:path*',
    '/drivers/:path*',
    '/finance/:path*',
    '/store-settings/:path*',
    '/governance/:path*',
    '/settings/:path*',
    '/print/:path*',
  ],
}
