/**
 * Structured Logging Utilities
 *
 * Provides consistent, structured logging across the application
 * with appropriate log levels and context information.
 */

// Re-export all logging functionality
export * from "./structured-logger"
export * from "./specialized-loggers"
export * from "./middleware-logger"
export * from "./config"

// Legacy logger for backward compatibility
type LogLevel = "debug" | "info" | "warn" | "error"
type LogContext = Record<string, any>

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    message: string
    stack?: string
    code?: string
  }
}

/**
 * Get the current log level from environment variables
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
  return ["debug", "info", "warn", "error"].includes(level) ? level : "info"
}

/**
 * Check if a log level should be output based on current configuration
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel()
  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }
  return levels[level] >= levels[currentLevel]
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    // Structured JSON logging for production
    return JSON.stringify(entry)
  } else {
    // Human-readable logging for development
    const timestamp = new Date(entry.timestamp).toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
    const error = entry.error
      ? `\n  Error: ${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ""}`
      : ""
    return `${timestamp} ${level} ${entry.message}${context}${error}`
  }
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && { context }),
    ...(error && {
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code,
      },
    }),
  }

  const formatted = formatLogEntry(entry)

  // Output to appropriate console method
  switch (level) {
    case "debug":
      console.debug(formatted)
      break
    case "info":
      console.info(formatted)
      break
    case "warn":
      console.warn(formatted)
      break
    case "error":
      console.error(formatted)
      break
  }
}

/**
 * Legacy logger interface for backward compatibility
 * @deprecated Use structuredLogger or specialized loggers instead
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext, error?: Error) =>
    log("error", message, context, error),

  /**
   * Create a child logger with default context
   */
  child: (defaultContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      log("debug", message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log("info", message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      log("warn", message, { ...defaultContext, ...context }),
    error: (message: string, context?: LogContext, error?: Error) =>
      log("error", message, { ...defaultContext, ...context }, error),
  }),
}

/**
 * Legacy request logging middleware
 * @deprecated Use withComprehensiveLogging from middleware-logger instead
 */
export function withRequestLogging(handler: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any) => {
    const startTime = Date.now()
    const requestId = Math.random().toString(36).substring(7)
    const requestLogger = logger.child({
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers["user-agent"],
      ip: req.headers["x-forwarded-for"] || req.headers["x-real-ip"],
    })

    requestLogger.info("Request started")

    try {
      await handler(req, res)

      const duration = Date.now() - startTime
      requestLogger.info("Request completed", {
        duration,
        statusCode: res.statusCode,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      requestLogger.error(
        "Request failed",
        {
          duration,
          statusCode: res.statusCode || 500,
        },
        error as Error,
      )
      throw error
    }
  }
}
