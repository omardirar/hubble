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

  // Database errors
  RUN_NOT_FOUND: "RUN_NOT_FOUND",
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  TENANT_CREATION_FAILED: "TENANT_CREATION_FAILED",

  // External service errors
  QSTASH_ERROR: "QSTASH_ERROR",
  QSTASH_PUBLISH_ERROR: "QSTASH_PUBLISH_ERROR",
  REDIS_ERROR: "REDIS_ERROR",
  REDIS_UNAVAILABLE: "REDIS_UNAVAILABLE",
  REDIS_LOCK_RELEASE_ERROR: "REDIS_LOCK_RELEASE_ERROR",
  REDIS_LOCK_REFRESH_ERROR: "REDIS_LOCK_REFRESH_ERROR",

  // Lock errors
  LOCK_ERROR: "LOCK_ERROR",
  LOCK_NOT_ACQUIRED: "LOCK_NOT_ACQUIRED",
  LOCK_SERVICE_UNAVAILABLE: "LOCK_SERVICE_UNAVAILABLE",

  // Provision errors
  PROVISION_ERROR: "PROVISION_ERROR",
  PROVISION_JOB_FAILED: "PROVISION_JOB_FAILED",
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

// Database-related errors
export class DatabaseError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { status: 500, code: options.code ?? ApiErrorCodes.DATABASE_ERROR, ...options })
    this.name = "DatabaseError"
  }
}

export class RunNotFoundError extends DatabaseError {
  constructor(correlationId: string) {
    super(`Provision run not found: ${correlationId}`, { code: "RUN_NOT_FOUND" })
    this.name = "RunNotFoundError"
  }
}

export class TenantNotFoundError extends DatabaseError {
  constructor(orgId: string) {
    super(`Tenant not found for organization: ${orgId}`, { code: "TENANT_NOT_FOUND" })
    this.name = "TenantNotFoundError"
  }
}

export class TenantCreationError extends DatabaseError {
  constructor(orgId: string, cause?: unknown) {
    super(`Failed to create tenant for organization: ${orgId}`, {
      code: "TENANT_CREATION_FAILED",
      cause,
    })
    this.name = "TenantCreationError"
  }
}

// External service errors
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(`${service} error: ${message}`, {
      status: 502,
      code: options.code ?? ApiErrorCodes.UPSTREAM_ERROR,
      ...options,
    })
    this.name = "ExternalServiceError"
  }
}

export class QStashError extends ExternalServiceError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super("QStash", message, { code: "QSTASH_ERROR", ...options })
    this.name = "QStashError"
  }
}

export class QStashPublishError extends QStashError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(`Publish failed: ${message}`, { code: "QSTASH_PUBLISH_ERROR", ...options })
    this.name = "QStashPublishError"
  }
}

export class RedisError extends ExternalServiceError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super("Redis", message, { code: "REDIS_ERROR", ...options })
    this.name = "RedisError"
  }
}

export class RedisUnavailableError extends RedisError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(`Service unavailable: ${message}`, { code: "REDIS_UNAVAILABLE", ...options })
    this.name = "RedisUnavailableError"
  }
}

export class RedisLockReleaseError extends RedisError {
  constructor(lockKey: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(`Failed to release lock: ${lockKey}`, { code: "REDIS_LOCK_RELEASE_ERROR", ...options })
    this.name = "RedisLockReleaseError"
  }
}

export class RedisLockRefreshError extends RedisError {
  constructor(lockKey: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(`Failed to refresh lock: ${lockKey}`, { code: "REDIS_LOCK_REFRESH_ERROR", ...options })
    this.name = "RedisLockRefreshError"
  }
}

// Lock-related errors
export class LockError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { status: 409, code: options.code ?? "LOCK_ERROR", ...options })
    this.name = "LockError"
  }
}

export class LockNotAcquiredError extends LockError {
  constructor(lockKey: string) {
    super(`Failed to acquire lock: ${lockKey}`, { code: "LOCK_NOT_ACQUIRED" })
    this.name = "LockNotAcquiredError"
  }
}

export class LockServiceUnavailableError extends LockError {
  constructor(lockKey: string) {
    super(`Lock service unavailable for key: ${lockKey}`, { code: "LOCK_SERVICE_UNAVAILABLE" })
    this.name = "LockServiceUnavailableError"
  }
}

// Provision-related errors
export class ProvisionError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { status: 500, code: options.code ?? "PROVISION_ERROR", ...options })
    this.name = "ProvisionError"
  }
}

export class ProvisionJobFailedError extends ProvisionError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(`Provision job failed: ${message}`, { code: "PROVISION_JOB_FAILED", ...options })
    this.name = "ProvisionJobFailedError"
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
