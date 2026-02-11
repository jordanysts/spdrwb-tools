import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === "/login"
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isPublicFile = req.nextUrl.pathname.match(/\.(gif|png|jpg|jpeg|svg|ico|webp)$/)
  
  // Allow API routes, public files, and login page
  if (isApiRoute || isPublicFile || isLoginPage) {
    return NextResponse.next()
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
