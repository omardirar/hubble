/**
 * Structured Logger
 *
 * Enhanced structured logging with consistent patterns, context management,
 * and specialized loggers for different parts of the application.
 */

import { logger } from "../index"

/**
 * Log context interface for type safety
 */
export interface LogContext {
  [key: string]: any
}

/**
 * Sensitive fields that should be redacted from logs
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "authorization",
  "cookie",
  "sessionId",
  "session_id",
  "creditCard",
  "credit_card",
  "ssn",
  "email", // Optionally redact emails in production
  "phone",
  "address",
]

/**
 * Redact sensitive information from log context
 */
export function sanitizeLogContext(context: LogContext): LogContext {
  const sanitized: LogContext = {}

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))

    if (isSensitive) {
      sanitized[key] = "[REDACTED]"
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogContext(value as LogContext)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Logger interface with enhanced functionality
 */
export interface StructuredLogger {
  debug: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext, error?: Error) => void

  // Enhanced methods
  child: (context: LogContext) => StructuredLogger
  withContext: (context: LogContext) => StructuredLogger
  withRequest: (requestId: string, method: string, url: string) => StructuredLogger
  withUser: (userId: string, orgId?: string) => StructuredLogger
  withOperation: (operation: string, correlationId?: string) => StructuredLogger
}

/**
 * Create a structured logger with enhanced context management
 */
export function createStructuredLogger(baseContext: LogContext = {}): StructuredLogger {
  const context = sanitizeLogContext({ ...baseContext })

  const log = {
    debug: (message: string, additionalContext?: LogContext) => {
      const sanitized = additionalContext ? sanitizeLogContext(additionalContext) : {}
      logger.debug(message, { ...context, ...sanitized })
    },
    info: (message: string, additionalContext?: LogContext) => {
      const sanitized = additionalContext ? sanitizeLogContext(additionalContext) : {}
      logger.info(message, { ...context, ...sanitized })
    },
    warn: (message: string, additionalContext?: LogContext) => {
      const sanitized = additionalContext ? sanitizeLogContext(additionalContext) : {}
      logger.warn(message, { ...context, ...sanitized })
    },
    error: (message: string, additionalContext?: LogContext, error?: Error) => {
      const sanitized = additionalContext ? sanitizeLogContext(additionalContext) : {}
      logger.error(message, { ...context, ...sanitized }, error)
    },

    child: (newContext: LogContext) => {
      return createStructuredLogger({ ...context, ...newContext })
    },

    withContext: (newContext: LogContext) => {
      return createStructuredLogger({ ...context, ...newContext })
    },

    withRequest: (requestId: string, method: string, url: string) => {
      return createStructuredLogger({
        ...context,
        requestId,
        method,
        url,
        timestamp: new Date().toISOString(),
      })
    },

    withUser: (userId: string, orgId?: string) => {
      return createStructuredLogger({
        ...context,
        userId,
        ...(orgId && { orgId }),
      })
    },

    withOperation: (operation: string, correlationId?: string) => {
      return createStructuredLogger({
        ...context,
        operation,
        ...(correlationId && { correlationId }),
      })
    },
  }

  return log
}

/**
 * Default structured logger instance
 */
export const structuredLogger = createStructuredLogger()

/**
 * Specialized loggers for different parts of the application
 */
export const loggers = {
  /**
   * API request logger with request context
   */
  api: (requestId: string, method: string, url: string) =>
    structuredLogger.withRequest(requestId, method, url),

  /**
   * User action logger with user context
   */
  user: (userId: string, orgId?: string) => structuredLogger.withUser(userId, orgId),

  /**
   * Database operation logger
   */
  database: (operation: string, correlationId?: string) =>
    structuredLogger.withOperation(operation, correlationId),

  /**
   * Connect service logger
   */
  connect: (correlationId?: string) => structuredLogger.withOperation("connect", correlationId),

  /**
   * Chat service logger
   */
  chat: (conversationId?: string) => structuredLogger.withOperation("chat", conversationId),

  /**
   * Authentication logger
   */
  auth: (userId?: string) => structuredLogger.withUser(userId || "unknown"),

  /**
   * Error logger with enhanced error context
   */
  error: (context: LogContext = {}) => structuredLogger.withContext(context),
}

/**
 * Log levels for consistent usage
 */
export const LogLevels = {
  DEBUG: "debug" as const,
  INFO: "info" as const,
  WARN: "warn" as const,
  ERROR: "error" as const,
} as const

/**
 * Common log messages for consistency
 */
export const LogMessages = {
  // API Messages
  API_REQUEST_STARTED: "api.request.started",
  API_REQUEST_COMPLETED: "api.request.completed",
  API_REQUEST_FAILED: "api.request.failed",
  API_VALIDATION_FAILED: "api.validation.failed",
  API_AUTHENTICATION_FAILED: "api.authentication.failed",
  API_AUTHORIZATION_FAILED: "api.authorization.failed",

  // Database Messages
  DB_QUERY_STARTED: "db.query.started",
  DB_QUERY_COMPLETED: "db.query.completed",
  DB_QUERY_FAILED: "db.query.failed",
  DB_CONNECTION_FAILED: "db.connection.failed",
  DB_TRANSACTION_STARTED: "db.transaction.started",
  DB_TRANSACTION_COMMITTED: "db.transaction.committed",
  DB_TRANSACTION_ROLLED_BACK: "db.transaction.rolled_back",

  // Connect Messages
  CONNECT_PROVISION_STARTED: "connect.provision.started",
  CONNECT_PROVISION_COMPLETED: "connect.provision.completed",
  CONNECT_PROVISION_FAILED: "connect.provision.failed",
  CONNECT_LOCK_ACQUIRED: "connect.lock.acquired",
  CONNECT_LOCK_RELEASED: "connect.lock.released",
  CONNECT_LOCK_FAILED: "connect.lock.failed",

  // Chat Messages
  CHAT_MESSAGE_SENT: "chat.message.sent",
  CHAT_MESSAGE_RECEIVED: "chat.message.received",
  CHAT_CONVERSATION_CREATED: "chat.conversation.created",
  CHAT_CONVERSATION_LOADED: "chat.conversation.loaded",

  // Authentication Messages
  AUTH_LOGIN_ATTEMPT: "auth.login.attempt",
  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILED: "auth.login.failed",
  AUTH_LOGOUT: "auth.logout",
  AUTH_TOKEN_REFRESHED: "auth.token.refreshed",

  // Error Messages
  ERROR_UNEXPECTED: "error.unexpected",
  ERROR_VALIDATION: "error.validation",
  ERROR_NETWORK: "error.network",
  ERROR_DATABASE: "error.database",
  ERROR_EXTERNAL_SERVICE: "error.external_service",
} as const

/**
 * Performance logging utilities
 */
export const performanceLogger = {
  /**
   * Log performance metrics
   */
  log: (operation: string, duration: number, context: LogContext = {}) => {
    structuredLogger.info("performance.metric", {
      operation,
      duration,
      ...context,
    })
  },

  /**
   * Create a performance timer
   */
  timer: (operation: string, context: LogContext = {}) => {
    const start = Date.now()
    return {
      end: (additionalContext: LogContext = {}) => {
        const duration = Date.now() - start
        performanceLogger.log(operation, duration, { ...context, ...additionalContext })
        return duration
      },
    }
  },
}

/**
 * Security logging utilities
 */
export const securityLogger = {
  /**
   * Log security events
   */
  log: (event: string, context: LogContext = {}) => {
    structuredLogger.warn("security.event", {
      event,
      ...context,
      timestamp: new Date().toISOString(),
    })
  },

  /**
   * Log authentication attempts
   */
  authAttempt: (userId: string, success: boolean, context: LogContext = {}) => {
    securityLogger.log("auth.attempt", {
      userId,
      success,
      ...context,
    })
  },

  /**
   * Log authorization failures
   */
  authFailure: (userId: string, resource: string, context: LogContext = {}) => {
    securityLogger.log("auth.failure", {
      userId,
      resource,
      ...context,
    })
  },

  /**
   * Log suspicious activity
   */
  suspiciousActivity: (activity: string, context: LogContext = {}) => {
    securityLogger.log("suspicious.activity", {
      activity,
      ...context,
    })
  },
}

/**
 * Business logic logging utilities
 */
export const businessLogger = {
  /**
   * Log business events
   */
  log: (event: string, context: LogContext = {}) => {
    structuredLogger.info("business.event", {
      event,
      ...context,
    })
  },

  /**
   * Log user actions
   */
  userAction: (action: string, userId: string, context: LogContext = {}) => {
    businessLogger.log("user.action", {
      action,
      userId,
      ...context,
    })
  },

  /**
   * Log feature usage
   */
  featureUsage: (feature: string, userId: string, context: LogContext = {}) => {
    businessLogger.log("feature.usage", {
      feature,
      userId,
      ...context,
    })
  },
}
