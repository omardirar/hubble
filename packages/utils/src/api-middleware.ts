/**
 * API Middleware Utilities for Vercel Functions
 *
 * Provides reusable middleware patterns for authentication, validation,
 * error handling, and common API function concerns.
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import { ApiErrors, sendError, sendSuccess } from "./errors"
import { z } from "zod"
// Note: These imports are moved here to avoid client-side bundling issues
// import { createBrowserClient } from "@hubble/db"
// import { extractJWTClaims } from "@hubble/auth"

export interface AuthenticatedRequest extends VercelRequest {
  auth: {
    userId: string
    orgId: string
    token: string
    supabase: any // Using any to avoid circular dependency
  }
  // Explicitly ensure these properties are available (they should be from VercelRequest)
  query: VercelRequest["query"]
  body: VercelRequest["body"]
  method: VercelRequest["method"]
}

export type AuthenticatedHandler = (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>

/**
 * Authentication middleware that extracts JWT claims and creates Supabase client
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // Validate authorization header
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith("Bearer ")) {
        console.warn("Request missing or invalid Authorization header")
        return sendError(res, ApiErrors.UNAUTHORIZED)
      }

      const token = authHeader.substring(7)

      // Extract user and organization information from JWT token
      let userId: string
      let orgId: string
      try {
        // Dynamic import to avoid client-side bundling issues
        const { extractJWTClaims } = await import("@hubble/auth")
        const claims = extractJWTClaims(token)
        userId = claims.userId
        orgId = claims.orgId!
      } catch (jwtError) {
        console.error("JWT claims extraction failed:", jwtError)
        return sendError(res, ApiErrors.UNAUTHORIZED, { reason: "Invalid token" })
      }

      // Create Supabase client with JWT token
      let supabase: any
      try {
        // Dynamic import to avoid client-side bundling issues
        const { createBrowserClient } = await import("@hubble/db")
        supabase = createBrowserClient({ authToken: token })
      } catch (dbError) {
        console.error("Database client creation failed:", dbError)
        return sendError(res, ApiErrors.INTERNAL_ERROR, { reason: "Database connection failed" })
      }

      // Extend request with auth information
      const authenticatedReq = req as AuthenticatedRequest
      authenticatedReq.auth = { userId, orgId, token, supabase }

      // Call the authenticated handler
      await handler(authenticatedReq, res)
    } catch (error) {
      console.error("Authentication middleware error:", error)
      return sendError(res, ApiErrors.INTERNAL_ERROR, {
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}

/**
 * Method validation middleware
 */
export function withMethods(allowedMethods: string[]) {
  return (handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      if (!allowedMethods.includes(req.method || "")) {
        return sendError(res, {
          code: "METHOD_NOT_ALLOWED",
          message: `Method ${req.method} not allowed. Allowed: ${allowedMethods.join(", ")}`,
          status: 405,
        })
      }
      await handler(req, res)
    }
  }
}

/**
 * Request validation middleware using Zod schemas or validation functions
 */
export function withValidation<T>(
  validator: { parse: (data: any) => T } | ((data: any) => T),
  source: "body" | "query" = "body",
) {
  return (
    handler: (req: VercelRequest & { validated: T }, res: VercelResponse) => Promise<void>,
  ) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      try {
        const data = source === "body" ? req.body : req.query
        const validated =
          typeof validator === "function" ? validator(data || {}) : validator.parse(data || {})

        // Extend request with validated data
        const validatedReq = req as VercelRequest & { validated: T }
        validatedReq.validated = validated

        await handler(validatedReq, res)
      } catch (validationError) {
        console.warn(`Validation error for ${source}:`, validationError)
        return sendError(res, ApiErrors.VALIDATION_ERROR, {
          reason: validationError instanceof Error ? validationError.message : "Invalid data",
        })
      }
    }
  }
}

/**
 * Comprehensive error handling wrapper
 */
export function withErrorHandling(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error("API function error:", {
        url: req.url,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes("JWT") || error.message.includes("token")) {
          return sendError(res, ApiErrors.UNAUTHORIZED, { reason: error.message })
        }
        if (error.message.includes("permission") || error.message.includes("access")) {
          return sendError(res, ApiErrors.FORBIDDEN, { reason: error.message })
        }
        if (error.message.includes("not found")) {
          return sendError(res, ApiErrors.NOT_FOUND, { reason: error.message })
        }
      }

      return sendError(res, ApiErrors.INTERNAL_ERROR, {
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}

/**
 * Rate limiting types and constants
 */
export const RateLimits = {
  STRICT: { requests: 10, window: 60 }, // 10 requests per minute (AI endpoints)
  STANDARD: { requests: 100, window: 60 }, // 100 requests per minute (CRUD)
  LENIENT: { requests: 1000, window: 60 }, // 1000 requests per minute (read-only)
}

/**
 * Rate limiting middleware (basic in-memory implementation)
 */
export function withRateLimit(config: { requests: number; window: number }) {
  const requests = new Map<string, { count: number; window: number }>()

  return (handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      const clientId =
        (req.headers["x-forwarded-for"] as string) || req.connection?.remoteAddress || "unknown"
      const now = Math.floor(Date.now() / 1000)
      const windowStart = Math.floor(now / config.window) * config.window

      const key = `${clientId}:${windowStart}`
      const current = requests.get(key) || { count: 0, window: windowStart }

      if (current.count >= config.requests) {
        return sendError(res, ApiErrors.RATE_LIMITED, {
          retryAfter: windowStart + config.window - now,
        })
      }

      requests.set(key, { count: current.count + 1, window: windowStart })

      // Cleanup old entries
      if (Math.random() < 0.01) {
        // 1% chance to cleanup
        for (const [k, v] of requests.entries()) {
          if (v.window < windowStart - config.window) {
            requests.delete(k)
          }
        }
      }

      await handler(req, res)
    }
  }
}

/**
 * Compose multiple middleware functions
 */
export function compose(...middlewares: any[]) {
  return middlewares.reduce(
    (a, b) =>
      (...args: any[]) =>
        a(b(...args)),
  )
}
