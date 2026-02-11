import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { trackEvent } from "@/lib/analytics"

// Simple in-memory rate limiter for API routes
const apiRateMap = new Map<string, { count: number; resetAt: number }>()

// Rate limits per route pattern (requests per minute)
const RATE_LIMITS: Record<string, number> = {
  '/api/tools/image': 10,      // AI image generation - expensive
  '/api/tools/runway': 5,       // Video generation - very expensive
  '/api/tools/veo': 5,          // Video generation - very expensive
  '/api/tools/chat': 20,        // Chat endpoint
  '/api/tools/upscaler': 10,    // Image upscaling
  '/api/tools/expression-editor': 15,
  '/api/tools/composite': 15,
  '/api/tools/tinypng': 20,
  '/api/tools/feedback': 30,    // Feedback - more lenient
}
const DEFAULT_API_LIMIT = 30

function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number; limit: number } {
  // Find matching rate limit
  let limit = DEFAULT_API_LIMIT
  for (const [pattern, patternLimit] of Object.entries(RATE_LIMITS)) {
    if (path.startsWith(pattern)) {
      limit = patternLimit
      break
    }
  }

  const key = `${ip}:${path.split('/').slice(0, 4).join('/')}`
  const now = Date.now()
  const windowMs = 60_000 // 1 minute

  const existing = apiRateMap.get(key)

  if (!existing || now > existing.resetAt) {
    apiRateMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, limit }
  }

  existing.count++

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, limit }
  }

  return { allowed: true, remaining: Math.max(0, limit - existing.count), limit }
}

// Cleanup old entries every 2 minutes
setInterval(() => {
  const now = Date.now()
  apiRateMap.forEach((entry, key) => {
    if (now > entry.resetAt) {
      apiRateMap.delete(key)
    }
  })
}, 120_000)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === "/login"
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")
  const isPublicFile = req.nextUrl.pathname.match(/\.(gif|png|jpg|jpeg|svg|ico|webp)$/)
  
  // Allow auth routes and public files without rate limiting
  if (isAuthRoute || isPublicFile || isLoginPage) {
    return NextResponse.next()
  }

  // Rate limit API routes
  if (isApiRoute) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    const { allowed, remaining, limit } = checkRateLimit(ip, req.nextUrl.pathname)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
          },
        }
      )
    }

    // Track API usage (fire-and-forget - don't block the response)
    const userEmail = req.auth?.user?.email || 'unknown'
    const apiPath = req.nextUrl.pathname.split('/').slice(0, 4).join('/') // e.g. /api/tools/image
    // Skip tracking analytics calls to avoid recursion
    if (!req.nextUrl.pathname.includes('/analytics')) {
      trackEvent({
        type: 'api_call',
        path: apiPath,
        user: userEmail,
        timestamp: new Date().toISOString(),
      }).catch(() => {}) // Silently ignore tracking failures
    }

    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    return response
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
