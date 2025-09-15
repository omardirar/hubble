/**
 * Rate Limiting Utilities
 *
 * Simple in-memory rate limiting for API functions.
 * For production, consider using Redis or a dedicated rate limiting service.
 */

interface RateLimitConfig {
  /** Maximum number of requests per window */
  max: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Custom key generator function */
  keyGenerator?: (req: any) => string
  /** Skip function to bypass rate limiting for certain requests */
  skip?: (req: any) => boolean
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limit data
const store = new Map<string, RateLimitEntry>()

/**
 * Clean up expired entries from the store
 */
function cleanup() {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000)

/**
 * Default key generator using IP address and user ID if available
 */
function defaultKeyGenerator(req: any): string {
  const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown"
  const userId = req.auth?.userId || "anonymous"
  return `${ip}:${userId}`
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  req: any,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetTime: number } {
  // Skip rate limiting if skip function returns true
  if (config.skip?.(req)) {
    return { allowed: true, remaining: config.max, resetTime: 0 }
  }

  const key = config.keyGenerator?.(req) || defaultKeyGenerator(req)
  const now = Date.now()
  const resetTime = now + config.windowMs

  // Get or create rate limit entry
  let entry = store.get(key)

  // Reset if window has expired
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime }
    store.set(key, entry)
  }

  // Check if request is allowed
  const allowed = entry.count < config.max
  if (allowed) {
    entry.count++
  }

  return {
    allowed,
    remaining: Math.max(0, config.max - entry.count),
    resetTime: entry.resetTime,
  }
}

/**
 * Rate limiting middleware for API functions
 */
export function withRateLimit(config: RateLimitConfig) {
  return (handler: (req: any, res: any) => Promise<void>) => {
    return async (req: any, res: any) => {
      const result = checkRateLimit(req, config)

      // Add rate limit headers
      res.setHeader("X-RateLimit-Limit", config.max.toString())
      res.setHeader("X-RateLimit-Remaining", result.remaining.toString())
      res.setHeader("X-RateLimit-Reset", new Date(result.resetTime).toISOString())

      if (!result.allowed) {
        return res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests",
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          },
        })
      }

      await handler(req, res)
    }
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimits = {
  /** Strict rate limit for expensive operations (AI, file uploads) */
  STRICT: { max: 10, windowMs: 60 * 1000 }, // 10 requests per minute

  /** Standard rate limit for most API endpoints */
  STANDARD: { max: 100, windowMs: 60 * 1000 }, // 100 requests per minute

  /** Relaxed rate limit for read-only operations */
  RELAXED: { max: 1000, windowMs: 60 * 1000 }, // 1000 requests per minute

  /** Authentication rate limit to prevent brute force */
  AUTH: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
} as const
