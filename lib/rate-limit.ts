// Simple in-memory rate limiter for Vercel serverless
// Works per instance - provides basic protection against abuse

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key)
    }
  })
}, 60_000) // Clean every minute

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit?: number
  /** Window duration in seconds */
  windowSeconds?: number
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const { limit = 30, windowSeconds = 60 } = options
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  const existing = rateLimitMap.get(identifier)

  if (!existing || now > existing.resetAt) {
    // New window
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    }
    rateLimitMap.set(identifier, entry)
    return { success: true, limit, remaining: limit - 1, resetAt: entry.resetAt }
  }

  // Existing window
  existing.count++
  const remaining = Math.max(0, limit - existing.count)

  if (existing.count > limit) {
    return { success: false, limit, remaining: 0, resetAt: existing.resetAt }
  }

  return { success: true, limit, remaining, resetAt: existing.resetAt }
}

/**
 * Extract client IP from request headers (works on Vercel)
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}