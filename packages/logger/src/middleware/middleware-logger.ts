/**
 * Middleware Logger
 *
 * Next.js middleware for automatic request/response logging
 * with performance metrics and error handling.
 */

import { NextRequest, NextResponse } from "next/server"
import { createStructuredLogger, LogContext } from "../core/structured-logger"
import { apiLogger } from "../specialized/specialized-loggers"

/**
 * Request logging middleware for Next.js API routes
 */
export function withRequestLogging<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    const request = args[0] as NextRequest
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    // Extract request information
    const method = request.method
    const url = request.url
    const userAgent = request.headers.get("user-agent") || "unknown"
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

    // Create request logger
    const requestLogger = createStructuredLogger({
      requestId,
      method,
      url,
      userAgent,
      ip,
      timestamp: new Date().toISOString(),
    })

    // Log request start
    apiLogger.requestStart(requestId, method, url, {
      userAgent,
      ip,
    })

    try {
      // Execute the handler
      const response = await handler(...args)

      // Calculate duration
      const duration = Date.now() - startTime

      // Log successful completion
      apiLogger.requestComplete(requestId, response.status, duration, {
        responseSize: response.headers.get("content-length") || "unknown",
      })

      return response
    } catch (error) {
      // Calculate duration
      const duration = Date.now() - startTime

      // Log error
      apiLogger.requestFailed(
        requestId,
        error as Error,
        500, // Default error status
        { duration },
      )

      // Re-throw the error
      throw error
    }
  }
}

/**
 * Error boundary logger for catching unhandled errors
 */
export function withErrorLogging<T extends any[]>(handler: (...args: T) => Promise<NextResponse>) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      const request = args[0] as NextRequest
      const requestId = crypto.randomUUID()

      // Log the error
      apiLogger.requestFailed(requestId, error as Error, 500, {
        method: request.method,
        url: request.url,
        errorType: error?.constructor?.name || "UnknownError",
      })

      // Return error response
      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          request_id: requestId,
        },
        { status: 500 },
      )
    }
  }
}

/**
 * Performance monitoring middleware
 */
export function withPerformanceMonitoring<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    const request = args[0] as NextRequest
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    // Start performance timer
    const timer = {
      start: startTime,
      end: () => Date.now() - startTime,
    }

    try {
      const response = await handler(...args)

      // Log performance metrics
      const duration = timer.end()
      const performanceLogger = createStructuredLogger({ component: "performance" })

      performanceLogger.info("request.performance", {
        requestId,
        method: request.method,
        url: request.url,
        duration,
        statusCode: response.status,
        memoryUsage: process.memoryUsage(),
      })

      return response
    } catch (error) {
      const duration = timer.end()

      // Log performance metrics for failed requests
      const performanceLogger = createStructuredLogger({ component: "performance" })
      performanceLogger.warn("request.performance.failed", {
        requestId,
        method: request.method,
        url: request.url,
        duration,
        error: (error as Error).message,
      })

      throw error
    }
  }
}

/**
 * Security logging middleware
 */
export function withSecurityLogging<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    const request = args[0] as NextRequest
    const requestId = crypto.randomUUID()

    // Extract security-relevant information
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    const referer = request.headers.get("referer") || "unknown"

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /javascript:/i, // JavaScript injection
    ]

    const url = request.url
    const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(url))

    if (isSuspicious) {
      const securityLogger = createStructuredLogger({ component: "security" })
      securityLogger.warn("security.suspicious_request", {
        requestId,
        ip,
        userAgent,
        referer,
        url,
        reason: "suspicious_pattern_detected",
      })
    }

    try {
      return await handler(...args)
    } catch (error) {
      // Log security-relevant errors
      const securityLogger = createStructuredLogger({ component: "security" })
      securityLogger.error("security.request_error", {
        requestId,
        ip,
        userAgent,
        error: (error as Error).message,
        url,
      })

      throw error
    }
  }
}

/**
 * Combined middleware with all logging features
 */
export function withComprehensiveLogging<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
) {
  return withRequestLogging(
    withPerformanceMonitoring(withSecurityLogging(withErrorLogging(handler))),
  )
}

/**
 * Utility function to create a logger for API routes
 */
export function createApiRouteLogger(endpoint: string) {
  return createStructuredLogger({
    component: "api",
    endpoint,
  })
}

/**
 * Utility function to log API route context
 */
export function logApiContext(
  logger: ReturnType<typeof createStructuredLogger>,
  context: {
    requestId: string
    method: string
    url: string
    userId?: string
    orgId?: string
    correlationId?: string
  },
) {
  logger.info("api.context", context)
}
