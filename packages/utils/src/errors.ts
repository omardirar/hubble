/**
 * Error Handling Utilities
 *
 * This module provides custom error classes and error handling utilities
 * for consistent error management across the Hubble application.
 */

/**
 * Custom application error class with optional error codes
 *
 * This class extends the native Error class to provide additional functionality
 * for application-specific error handling. It includes an optional error code
 * that can be used for programmatic error handling and user-friendly error messages.
 *
 * Features:
 * - Extends native Error class
 * - Optional error code for programmatic handling
 * - Consistent error naming
 * - Maintains stack trace
 *
 * @param message - Human-readable error message
 * @param code - Optional error code for programmatic handling
 */
export interface AppErrorOptions {
  code?: string
  status?: number
  details?: Record<string, unknown>
  cause?: unknown
}

export class AppError extends Error {
  declare cause?: unknown
  public readonly code: string
  public readonly status: number
  public readonly details?: Record<string, unknown>

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message)
    this.name = "AppError"
    this.code = options.code ?? ApiErrorCodes.INTERNAL_ERROR
    this.status = options.status ?? 500
    this.details = options.details
    if (options.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

/**
 * Standard API error codes for consistent error handling
 */
export const ApiErrorCodes = {
  // Client errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  ORG_REQUIRED: "ORG_REQUIRED",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  UPSTREAM_AUTH_ERROR: "UPSTREAM_AUTH_ERROR",
  ORG_NOT_FOUND: "ORG_NOT_FOUND",
} as const

export class ValidationError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, {
      status: 400,
      code: options.code ?? ApiErrorCodes.VALIDATION_ERROR,
      ...options,
    })
    this.name = "ValidationError"
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { status: 401, code: options.code ?? ApiErrorCodes.UNAUTHORIZED, ...options })
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { status: 403, code: options.code ?? ApiErrorCodes.FORBIDDEN, ...options })
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { status: 404, code: options.code ?? ApiErrorCodes.NOT_FOUND, ...options })
    this.name = "NotFoundError"
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { status: 409, code: options.code ?? ApiErrorCodes.CONFLICT, ...options })
    this.name = "ConflictError"
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limited", options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { status: 429, code: options.code ?? ApiErrorCodes.RATE_LIMITED, ...options })
    this.name = "RateLimitError"
  }
}

export class OrgRequiredError extends AppError {
  constructor(
    message = "Organization context required",
    options: Omit<AppErrorOptions, "status"> = {},
  ) {
    super(message, { status: 400, code: options.code ?? ApiErrorCodes.ORG_REQUIRED, ...options })
    this.name = "OrgRequiredError"
  }
}

export interface ErrorResponseShape {
  status: number
  payload: {
    error: {
      code: string
      message: string
    }
    details?: Record<string, unknown>
  }
}

export function toErrorResponseShape(error: unknown): ErrorResponseShape {
  if (error instanceof AppError) {
    return {
      status: error.status,
      payload: {
        error: {
          code: error.code,
          message: error.message,
        },
        ...(error.details ? { details: error.details } : {}),
      },
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    status: 500,
    payload: {
      error: {
        code: ApiErrorCodes.INTERNAL_ERROR,
        message,
      },
    },
  }
}

// TODO: Add HTTP→AppError mapping helpers
//   Context: Provide utilities to convert fetch/Response errors to typed AppError instances for UI handling.
//   labels: area/utils, feature/errors, type/quality
//   assignees: omzification
//   milestone: 0.0.1
