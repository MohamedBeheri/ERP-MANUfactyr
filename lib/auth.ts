import { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCK_MS = 5 * 60 * 1000

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const key = credentials.username.toLowerCase()
        const attempt = loginAttempts.get(key)
        if (attempt && attempt.lockedUntil > Date.now()) {
          throw new Error('محاولات دخول كتيرة غلط، حاول تاني بعد شوية')
        }

        // الدور والصلاحيات بيتحددوا من حساب المستخدم نفسه — مش من الفورم
        const user = await prisma.user.findFirst({
          where: {
            username: credentials.username,
            status: 'ACTIVE',
          },
        })

        const isPasswordValid = user ? await bcrypt.compare(credentials.password, user.password) : false

        if (!user || !isPasswordValid) {
          const next = { count: (attempt?.count || 0) + 1, lockedUntil: 0 }
          if (next.count >= MAX_ATTEMPTS) next.lockedUntil = Date.now() + LOCK_MS
          loginAttempts.set(key, next)
          return null
        }

        loginAttempts.delete(key)

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        })

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
        } as any
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.username = user.username
        token.permissions = (user as any).permissions || []
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.username = token.username
        ;(session.user as any).permissions = (token as any).permissions || []
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}
