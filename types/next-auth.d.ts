import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      username: string
      role: string
      permissions: string[]
    }
  }
  interface User {
    role: string
    username: string
    permissions?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    username: string
    permissions?: string[]
  }
}
