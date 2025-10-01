/**
 * Browser-Compatible Logger
 *
 * Lightweight logger for browser/client-side usage that doesn't depend on
 * Node.js APIs like process.env. Uses localStorage for configuration
 * and provides a subset of the full logger API.
 */

/**
 * Log levels in order of severity
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const

type LogLevel = keyof typeof LOG_LEVELS
type LogContext = Record<string, any>

/**
 * Get log level from localStorage or default to INFO
 */
function getLogLevel(): LogLevel {
  if (typeof window === "undefined") {
    return "INFO"
  }

  try {
    const level = localStorage.getItem("LOG_LEVEL")?.toUpperCase() as LogLevel
    return level && LOG_LEVELS[level] !== undefined ? level : "INFO"
  } catch {
    return "INFO"
  }
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel()
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

/**
 * Sensitive fields that should be redacted from logs
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "apikey",
  "api_key",
  "secret",
  "authorization",
  "cookie",
  "sessionid",
  "session_id",
  "creditcard",
  "credit_card",
  "ssn",
]

/**
 * Redact sensitive information from log context
 */
function sanitizeContext(context: LogContext): LogContext {
  const sanitized: LogContext = {}

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))

    if (isSensitive) {
      sanitized[key] = "[REDACTED]"
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value as LogContext)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Format log entry for browser console
 */
function formatLogEntry(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const sanitizedContext = context ? sanitizeContext(context) : {}
  const contextStr =
    Object.keys(sanitizedContext).length > 0 ? ` ${JSON.stringify(sanitizedContext)}` : ""
  return `[${timestamp}] ${level} ${message}${contextStr}`
}

/**
 * Core logging function for browser
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) return

  const formatted = formatLogEntry(level, message, context)

  // Use appropriate console method
  switch (level) {
    case "DEBUG":
      console.debug(formatted, error || "")
      break
    case "INFO":
      console.info(formatted, error || "")
      break
    case "WARN":
      console.warn(formatted, error || "")
      break
    case "ERROR":
      console.error(formatted, error || "")
      break
  }
}

/**
 * Browser logger interface
 */
export interface BrowserLogger {
  debug: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext, error?: Error) => void
  child: (defaultContext: LogContext) => BrowserLogger
}

/**
 * Create a browser logger with optional default context
 */
export function createBrowserLogger(defaultContext: LogContext = {}): BrowserLogger {
  return {
    debug: (message: string, context?: LogContext) =>
      log("DEBUG", message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log("INFO", message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      log("WARN", message, { ...defaultContext, ...context }),
    error: (message: string, context?: LogContext, error?: Error) =>
      log("ERROR", message, { ...defaultContext, ...context }, error),
    child: (newContext: LogContext) => createBrowserLogger({ ...defaultContext, ...newContext }),
  }
}

/**
 * Default browser logger instance
 */
export const browserLogger = createBrowserLogger()

/**
 * Specialized browser loggers for different contexts
 */
export const browserLoggers = {
  /**
   * Chat logger for client-side chat operations
   */
  chat: (conversationId?: string) =>
    createBrowserLogger({
      component: "chat",
      ...(conversationId && { conversationId }),
    }),

  /**
   * UI logger for client-side UI events
   */
  ui: (component: string) =>
    createBrowserLogger({
      component: "ui",
      uiComponent: component,
    }),

  /**
   * API logger for client-side API calls
   */
  api: (endpoint: string) =>
    createBrowserLogger({
      component: "api",
      endpoint,
    }),
}
