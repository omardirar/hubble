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
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string, // Optional error code for programmatic handling
  ) {
    super(message)
    this.name = "AppError" // Set the error name for identification
  }
}

/**
 * Standard API error codes for consistent error handling
 */
export const ApiErrors = {
  // Client errors (4xx)
  VALIDATION_ERROR: { code: "VALIDATION_ERROR", message: "Invalid request data", status: 400 },
  UNAUTHORIZED: { code: "UNAUTHORIZED", message: "Authentication required", status: 401 },
  FORBIDDEN: { code: "FORBIDDEN", message: "Access denied", status: 403 },
  NOT_FOUND: { code: "NOT_FOUND", message: "Resource not found", status: 404 },
  RATE_LIMITED: { code: "RATE_LIMITED", message: "Too many requests", status: 429 },

  // Server errors (5xx)
  INTERNAL_ERROR: { code: "INTERNAL_ERROR", message: "Internal server error", status: 500 },
  UPSTREAM_ERROR: { code: "UPSTREAM_ERROR", message: "Upstream service error", status: 502 },
  DATABASE_ERROR: { code: "DATABASE_ERROR", message: "Database operation failed", status: 500 },
} as const

/**
 * Send standardized success response
 */
export function sendSuccess(res: any, data?: any, status: number = 200) {
  return res.status(status).json(data)
}

/**
 * Send standardized error response
 */
export function sendError(
  res: any,
  error: { code: string; message: string; status: number },
  context?: Record<string, any>,
) {
  const response: any = {
    error: error.code,
    message: error.message,
    ...context,
  }

  return res.status(error.status).json(response)
}

// TODO: Add HTTP→AppError mapping helpers
//   Context: Provide utilities to convert fetch/Response errors to typed AppError instances for UI handling.
//   labels: area/utils, feature/errors, type/quality
//   assignees: omzification
//   milestone: 0.0.1
