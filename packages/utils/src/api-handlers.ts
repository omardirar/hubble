/**
 * API Route Handler Utilities
 *
 * This module provides common patterns and utilities for Next.js API route handlers
 * to ensure consistency, reduce duplication, and follow best practices.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createBrowserClient } from "@hubble/db"
import { logger } from "./logger"
import { extractJWTClaims } from "@hubble/auth"
import { ApiErrorCodes } from "./errors"

type Logger = ReturnType<typeof logger.child>

/**
 * Authentication context for API handlers
 */
export interface AuthContext {
  userId: string
  orgId: string
  token: string
  supabase: ReturnType<typeof createBrowserClient>
}

/**
 * Common API handler options
 */
export interface ApiHandlerOptions {
  /** Whether to require authentication (default: true) */
  requireAuth?: boolean
  /** Whether to require organization context (default: true) */
  requireOrg?: boolean
  /** Custom logger context */
  loggerContext?: Record<string, unknown>
}

/**
 * Get authentication context from Clerk
 */
export async function getAuthContext(options: ApiHandlerOptions = {}): Promise<AuthContext | null> {
  const { requireAuth = true, requireOrg = true } = options

  if (!requireAuth) {
    return null
  }

  const { getToken, userId } = await auth()
  const token = await getToken()

  if (!token || !userId) {
    return null
  }

  if (requireOrg) {
    const { orgId } = extractJWTClaims(token)
    if (!orgId) {
      return null
    }
    const supabase = createBrowserClient({ authToken: token })
    return { userId, orgId, token, supabase }
  }

  const supabase = createBrowserClient({ authToken: token })
  return { userId, orgId: userId, token, supabase } // Use userId as orgId fallback
}

/**
 * Create a standardized API handler with common patterns
 */
export function createApiHandler(
  handler: (request: any, auth: AuthContext | null, logger: Logger) => Promise<any>,
  options: ApiHandlerOptions = {},
) {
  return async (request: any): Promise<any> => {
    const requestLogger = logger.child({
      method: request.method,
      url: request.url,
      ...options.loggerContext,
    })

    try {
      // Get authentication context
      const authContext = await getAuthContext(options)

      if (options.requireAuth && !authContext) {
        requestLogger.warn("Unauthorized request")
        return NextResponse.json(
          { error: "Unauthorized", code: ApiErrorCodes.UNAUTHORIZED },
          { status: 401 },
        ) as any
      }

      // Call the handler
      return await handler(request, authContext, requestLogger)
    } catch (error) {
      requestLogger.error("API handler failed", {
        error: error instanceof Error ? error.message : String(error),
      })

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes("validation")) {
          return NextResponse.json(
            { error: "Invalid request data", code: ApiErrorCodes.VALIDATION_ERROR },
            { status: 400 },
          ) as any
        }
      }

      return NextResponse.json(
        { error: "Internal server error", code: ApiErrorCodes.INTERNAL_ERROR },
        { status: 500 },
      ) as NextResponse<any>
    }
  }
}

/**
 * Verify organization exists in Clerk mirror
 */
export async function verifyOrganization(
  supabase: ReturnType<typeof createBrowserClient>,
  orgId: string,
  logger: Logger,
): Promise<boolean> {
  const { data: orgData, error: orgError } = await supabase.rpc("get_org_from_clerk_mirror", {
    p_org_id: orgId,
  })

  if (orgError || !orgData) {
    logger.error("Organization not found in Clerk mirror", { error: orgError?.message })
    return false
  }

  return true
}

/**
 * Handle database errors with standardized responses
 */
export function handleDatabaseError(error: any, operation: string, logger: Logger): NextResponse {
  logger.error(`Database error during ${operation}`, { error: error.message })

  return NextResponse.json(
    { error: `Failed to ${operation}`, code: ApiErrorCodes.DATABASE_ERROR },
    { status: 500 },
  )
}

/**
 * Handle upstream API errors with standardized responses
 */
export function handleUpstreamError(
  response: Response,
  service: string,
  logger: Logger,
): NextResponse {
  const status = response.status
  const statusText = response.statusText

  logger.error(`${service} API error`, { status, statusText })

  if (status === 401) {
    return NextResponse.json(
      { error: "Invalid API key", code: ApiErrorCodes.UPSTREAM_AUTH_ERROR },
      { status: 502 },
    )
  } else if (status === 429) {
    return NextResponse.json(
      { error: "Rate limit exceeded", code: ApiErrorCodes.RATE_LIMITED },
      { status: 429 },
    )
  } else if (status >= 500) {
    return NextResponse.json(
      { error: `${service} service unavailable`, code: ApiErrorCodes.UPSTREAM_ERROR },
      { status: 502 },
    )
  } else {
    return NextResponse.json(
      { error: "Upstream error", code: ApiErrorCodes.UPSTREAM_ERROR },
      { status: 502 },
    )
  }
}

/**
 * Parse and validate request body with error handling
 */
export async function parseRequestBody<T>(
  request: NextRequest,
  validator: (data: unknown) => T,
  logger: Logger,
): Promise<T | NextResponse> {
  try {
    const body = await request.json()
    return validator(body)
  } catch (error) {
    logger.warn("Failed to parse request body", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Invalid request body", code: ApiErrorCodes.VALIDATION_ERROR },
      { status: 400 },
    )
  }
}
