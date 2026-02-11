import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// Allowed email domain
const ALLOWED_DOMAIN = "subtropicstudios.com"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Check if email domain is allowed
      if (user.email) {
        const domain = user.email.split("@")[1]
        if (domain === ALLOWED_DOMAIN) {
          return true
        }
      }
      // Reject sign-in for non-allowed domains
      return false
    },
    async session({ session, token }) {
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
