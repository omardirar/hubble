/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for tracking and logging performance metrics
 * including database operations, API calls, and general operations.
 */

// TODO: Add OpenTelemetry spans for performance tracking
//   Context: Wrap performance timers with OpenTelemetry spans to enable distributed tracing and performance analysis across service boundaries.
//   labels: area/observability, feature/tracing, type/enhancement
//   assignees: omzification
//   milestone: 0.1.0

import { structuredLogger } from "../core/structured-logger"

/**
 * Performance threshold configuration (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Database query threshold - log warning if exceeded */
  DATABASE_QUERY: 1000, // 1 second
  /** API request threshold - log warning if exceeded */
  API_REQUEST: 2000, // 2 seconds
  /** General operation threshold - log warning if exceeded */
  OPERATION: 3000, // 3 seconds
} as const

/**
 * Timer for measuring operation duration
 */
export interface PerformanceTimer {
  /** End the timer and return duration in milliseconds */
  end: (additionalContext?: Record<string, any>) => number
  /** Get current elapsed time without ending the timer */
  elapsed: () => number
}

/**
 * Create a performance timer for an operation
 *
 * @param operation - Name of the operation being measured
 * @param context - Additional context to include in logs
 * @returns Timer object with end() method
 */
export function createPerformanceTimer(
  operation: string,
  context: Record<string, any> = {},
): PerformanceTimer {
  const start = Date.now()

  return {
    end: (additionalContext: Record<string, any> = {}) => {
      const duration = Date.now() - start
      const fullContext = { ...context, ...additionalContext, duration, operation }

      // Determine threshold based on operation type
      let threshold: number = PERFORMANCE_THRESHOLDS.OPERATION
      if (operation.includes("database") || operation.includes("query")) {
        threshold = PERFORMANCE_THRESHOLDS.DATABASE_QUERY
      } else if (operation.includes("api") || operation.includes("request")) {
        threshold = PERFORMANCE_THRESHOLDS.API_REQUEST
      }

      // Log based on duration
      if (duration > threshold) {
        structuredLogger.warn("performance.threshold_exceeded", {
          ...fullContext,
          threshold,
        })
      } else {
        structuredLogger.debug("performance.operation_completed", fullContext)
      }

      return duration
    },
    elapsed: () => Date.now() - start,
  }
}

/**
 * Wrap a database operation with performance monitoring
 *
 * @param operation - Name of the database operation
 * @param table - Table name being operated on
 * @param fn - Async function to execute
 * @param context - Additional context
 * @returns Result of the function
 */
export async function withDatabasePerformance<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
  context: Record<string, any> = {},
): Promise<T> {
  const timer = createPerformanceTimer(`database.${operation}`, {
    ...context,
    table,
    operation,
  })

  try {
    const result = await fn()
    timer.end({ success: true })
    return result
  } catch (error) {
    const duration = timer.elapsed()
    structuredLogger.error(
      "performance.database_operation_failed",
      {
        ...context,
        table,
        operation,
        duration,
        error: error instanceof Error ? error.message : String(error),
      },
      error as Error,
    )
    throw error
  }
}

/**
 * Wrap an API call with performance monitoring
 *
 * @param endpoint - API endpoint being called
 * @param method - HTTP method
 * @param fn - Async function to execute
 * @param context - Additional context
 * @returns Result of the function
 */
export async function withApiPerformance<T>(
  endpoint: string,
  method: string,
  fn: () => Promise<T>,
  context: Record<string, any> = {},
): Promise<T> {
  const timer = createPerformanceTimer(`api.${method.toLowerCase()}`, {
    ...context,
    endpoint,
    method,
  })

  try {
    const result = await fn()
    timer.end({ success: true })
    return result
  } catch (error) {
    const duration = timer.elapsed()
    structuredLogger.error(
      "performance.api_call_failed",
      {
        ...context,
        endpoint,
        method,
        duration,
        error: error instanceof Error ? error.message : String(error),
      },
      error as Error,
    )
    throw error
  }
}

/**
 * Decorator for measuring function performance
 *
 * @param operation - Name of the operation
 * @param context - Additional context
 */
export function measurePerformance(operation: string, context: Record<string, any> = {}) {
  return function <T extends (...args: any[]) => Promise<any>>(
    _target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const originalMethod = descriptor.value

    if (!originalMethod) {
      return descriptor
    }

    descriptor.value = async function (this: any, ...args: any[]) {
      const timer = createPerformanceTimer(operation, context)

      try {
        const result = await originalMethod.apply(this, args)
        timer.end({ success: true })
        return result
      } catch (error) {
        const duration = timer.elapsed()
        structuredLogger.error(
          "performance.operation_failed",
          {
            ...context,
            operation,
            duration,
            error: error instanceof Error ? error.message : String(error),
          },
          error as Error,
        )
        throw error
      }
    } as T

    return descriptor
  }
}

/**
 * Simple async function wrapper for performance monitoring
 *
 * @param operation - Name of the operation
 * @param fn - Async function to execute
 * @param context - Additional context
 * @returns Result of the function
 */
export async function withPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  context: Record<string, any> = {},
): Promise<T> {
  const timer = createPerformanceTimer(operation, context)

  try {
    const result = await fn()
    timer.end({ success: true })
    return result
  } catch (error) {
    const duration = timer.elapsed()
    structuredLogger.error(
      "performance.operation_failed",
      {
        ...context,
        operation,
        duration,
        error: error instanceof Error ? error.message : String(error),
      },
      error as Error,
    )
    throw error
  }
}
