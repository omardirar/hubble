/**
 * API Route Handler Utilities
 *
 * This module provides common patterns and utilities for Next.js API route handlers
 * to ensure consistency, reduce duplication, and follow best practices.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createBrowserClient } from "@hubble/db"
import { logger } from "@hubble/logger"
import { extractJWTClaims } from "@hubble/auth"
import { getClerkRpcName } from "./clerk-schema"
import {
  ApiErrorCodes,
  AppError,
  OrgRequiredError,
  UnauthorizedError,
  ValidationError,
  toErrorResponseShape,
} from "./errors"
import { ZodError } from "zod"

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
    throw new UnauthorizedError()
  }

  const supabase = createBrowserClient({ authToken: token })

  let orgId: string | undefined
  try {
    const claims = extractJWTClaims(token)
    orgId = claims.orgId
  } catch (error) {
    if (error instanceof Error && error.message.includes("Organization ID")) {
      orgId = undefined
    } else {
      throw new UnauthorizedError("Invalid auth token", { cause: error })
    }
  }

  if (requireOrg && !orgId) {
    throw new OrgRequiredError()
  }

  return {
    userId,
    orgId: orgId ?? userId,
    token,
    supabase,
  }
}

// TODO: Add rate limiting middleware
//   Context: Implement rate limiting for API endpoints to prevent abuse and ensure fair usage.
//   labels: area/utils, feature/security, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

/**
 * Create a standardized API handler with common patterns
 */
// TODO: Add generic type parameters for better type safety
//   Context: Replace 'any' types with proper generic constraints for request/response types.
//   labels: area/utils, feature/types, type/quality
//   assignees: omzification
//   milestone: 0.0.1

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

      // Call the handler
      return await handler(request, authContext, requestLogger)
    } catch (error) {
      if (error instanceof AppError) {
        const logPayload = {
          code: error.code,
          status: error.status,
          message: error.message,
        }
        if (error.status >= 500) {
          requestLogger.error("api.handler.error", logPayload)
        } else {
          requestLogger.warn("api.handler.error", logPayload)
        }
      } else {
        requestLogger.error("api.handler.unexpected_error", {
          error: error instanceof Error ? error.message : String(error),
        })
      }

      const { status, payload } = toErrorResponseShape(error)
      return NextResponse.json(payload, { status }) as NextResponse<any>
    }
  }
}

/**
 * Verify organization exists in Clerk mirror and ensure tenant exists
 */
export async function verifyOrganization(
  supabase: ReturnType<typeof createBrowserClient>,
  orgId: string,
  logger: Logger,
): Promise<boolean> {
  // First check if org exists in Clerk
  const { data: orgData, error: orgError } = await supabase.rpc(
    getClerkRpcName("get_org_from_clerk_mirror"),
    {
      p_org_id: orgId,
    },
  )

  if (orgError || !orgData) {
    logger.error("Organization not found in Clerk mirror", { error: orgError?.message })
    return false
  }

  // Ensure tenant exists in tenants table
  const { error: tenantError } = await supabase.rpc("ensure_tenant_exists", {
    p_org_id: orgId,
  })

  if (tenantError) {
    logger.error("Failed to ensure tenant exists", { error: tenantError.message })
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
    {
      error: {
        code: ApiErrorCodes.DATABASE_ERROR,
        message: `Failed to ${operation}`,
      },
    },
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
      { error: { code: ApiErrorCodes.UPSTREAM_AUTH_ERROR, message: "Invalid API key" } },
      { status: 502 },
    )
  } else if (status === 429) {
    return NextResponse.json(
      { error: { code: ApiErrorCodes.RATE_LIMITED, message: "Rate limit exceeded" } },
      { status: 429 },
    )
  } else if (status >= 500) {
    return NextResponse.json(
      {
        error: {
          code: ApiErrorCodes.UPSTREAM_ERROR,
          message: `${service} service unavailable`,
        },
      },
      { status: 502 },
    )
  } else {
    return NextResponse.json(
      { error: { code: ApiErrorCodes.UPSTREAM_ERROR, message: "Upstream error" } },
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
): Promise<T> {
  try {
    const body = await request.json()
    try {
      return validator(body)
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("api.request.validation_failed", {
          issues: error.issues,
        })
        throw new ValidationError("Request validation failed", {
          details: { issues: error.issues },
          cause: error,
        })
      }
      throw error
    }
  } catch (error) {
    logger.warn("Failed to parse request body", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new ValidationError("Invalid JSON body", { cause: error })
  }
}
