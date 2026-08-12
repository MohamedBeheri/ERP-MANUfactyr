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
        // جلسة بمستخدم متمسوح/معطّل (بعد فحص قاعدة البيانات الدوري) بتتعامل كغير مسجّلة → صفحة الدخول
        return !!token && !(token as any).invalid
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/factory/:path*',
    '/catalog/:path*',
    '/warehouse/:path*',
    '/sales/:path*',
    '/customers/:path*',
    '/key-accounts/:path*',
    '/delegates/:path*',
    '/drivers/:path*',
    '/treasury/:path*',
    '/finance/:path*',
    '/store-settings/:path*',
    '/online-orders/:path*',
    '/cafe/:path*',
    '/governance/:path*',
    '/settings/:path*',
    '/print/:path*',
  ],
}
