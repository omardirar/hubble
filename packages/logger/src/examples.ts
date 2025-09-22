/**
 * Logging Package Examples
 *
 * Comprehensive examples showing how to use the new structured logging package
 * across different parts of the application.
 */

import { NextResponse } from "next/server"
import {
  // Core logging
  structuredLogger,
  createStructuredLogger,

  // Specialized loggers
  apiLogger,
  databaseLogger,
  connectLogger,
  chatLogger,
  authLogger,

  // Utility loggers
  performanceLogger,
  securityLogger,
  businessLogger,

  // Middleware
  withComprehensiveLogging,
  withRequestLogging,
  withPerformanceMonitoring,
  withSecurityLogging,

  // Configuration
  getLoggingConfig,
  LOGGING_PRESETS,
} from "./index"

/**
 * Example 1: Basic Structured Logging
 */
export function basicLoggingExample() {
  // Simple logging
  structuredLogger.info("Application started", {
    version: "1.0.0",
    environment: "production",
  })

  // Error logging with context
  try {
    throw new Error("Something went wrong")
  } catch (error) {
    structuredLogger.error(
      "Operation failed",
      {
        operation: "data_processing",
        userId: "user123",
      },
      error as Error,
    )
  }

  // Child logger with default context
  const userLogger = structuredLogger.child({ userId: "user123", orgId: "org456" })
  userLogger.info("User action performed", { action: "login" })
}

/**
 * Example 2: API Route Logging
 */
export function apiRouteLoggingExample() {
  // Request logging
  apiLogger.requestStart("req123", "POST", "/api/users")
  apiLogger.requestComplete("req123", 201, 150)

  // Error logging
  apiLogger.requestFailed("req123", new Error("Database connection failed"), 500)

  // Validation errors
  apiLogger.validationFailed("req123", [
    { field: "email", message: "Invalid email format" },
    { field: "password", message: "Password too short" },
  ])

  // Authentication/Authorization
  apiLogger.authFailed("req123", "Invalid token")
  apiLogger.authorizationFailed("req123", "user123", "/api/admin")
}

/**
 * Example 3: Database Operation Logging
 */
export function databaseLoggingExample() {
  // Query logging
  databaseLogger.queryStart("select", "users", { userId: "user123" })
  databaseLogger.queryComplete("select", "users", 45, 10, { userId: "user123" })

  // Error logging
  databaseLogger.queryFailed("insert", "users", new Error("Duplicate key"), {
    userId: "user123",
  })

  // Connection issues
  databaseLogger.connectionFailed(new Error("Connection timeout"))

  // Transaction logging
  const transactionId = "txn123"
  databaseLogger.transactionStart(transactionId)
  databaseLogger.transactionCommit(transactionId, 200)
  // or
  databaseLogger.transactionRollback(transactionId, "Validation failed")
}

/**
 * Example 4: Connect Service Logging
 */
export function connectLoggingExample() {
  const correlationId = "corr123"
  const orgId = "org456"

  // Provisioning flow
  connectLogger.provisionStart(correlationId, orgId)
  connectLogger.stepProgress(correlationId, "create_database", "starting")
  connectLogger.stepComplete(correlationId, "create_database", 500)
  connectLogger.provisionComplete(correlationId, orgId, 2000)

  // Lock management
  connectLogger.lockAcquired(correlationId, "provision:org:org456")
  connectLogger.lockReleased(correlationId, "provision:org:org456")

  // Error handling
  connectLogger.stepFailed(correlationId, "create_database", new Error("Database creation failed"))
  connectLogger.provisionFailed(correlationId, orgId, new Error("Provisioning failed"))
}

/**
 * Example 5: Chat Service Logging
 */
export function chatLoggingExample() {
  const conversationId = "conv123"
  const userId = "user123"

  // Message logging
  chatLogger.messageSent(conversationId, userId, 150)
  chatLogger.messageReceived(conversationId, 200)

  // Conversation management
  chatLogger.conversationCreated(conversationId, userId, "New Chat")
  chatLogger.conversationLoaded(conversationId, 25)

  // AI response logging
  chatLogger.aiResponseStart(conversationId, 100)
  chatLogger.aiResponseComplete(conversationId, 250, 1500)

  // Error logging
  chatLogger.chatError("message_send_failed", new Error("Network error"))
}

/**
 * Example 6: Authentication Logging
 */
export function authLoggingExample() {
  const userId = "user123"

  // Login flow
  authLogger.loginAttempt(userId, "oauth")
  authLogger.loginSuccess(userId, "oauth")

  // Error cases
  authLogger.loginFailed(userId, "oauth", "Invalid credentials")

  // Token management
  authLogger.tokenRefreshed(userId)
  authLogger.logout(userId)

  // General auth errors
  authLogger.authError("token_validation", new Error("Token expired"))
}

/**
 * Example 7: Performance Logging
 */
export function performanceLoggingExample() {
  // Manual performance logging
  performanceLogger.log("database_query", 150, {
    table: "users",
    operation: "select",
  })

  // Timer-based performance logging
  const timer = performanceLogger.timer("api_request", { endpoint: "/api/users" })
  // ... do work ...
  const duration = timer.end({ statusCode: 200 })

  console.log(`Request completed in ${duration}ms`)
}

/**
 * Example 8: Security Logging
 */
export function securityLoggingExample() {
  // Authentication attempts
  securityLogger.authAttempt("user123", true)
  securityLogger.authAttempt("user456", false, { reason: "invalid_password" })

  // Authorization failures
  securityLogger.authFailure("user123", "/api/admin")

  // Suspicious activity
  securityLogger.suspiciousActivity("multiple_failed_logins", {
    userId: "user123",
    attempts: 5,
    timeWindow: "5m",
  })
}

/**
 * Example 9: Business Logic Logging
 */
export function businessLoggingExample() {
  // General business events
  businessLogger.log("user_registration", {
    userId: "user123",
    plan: "premium",
  })

  // User actions
  businessLogger.userAction("profile_update", "user123", {
    fields: ["email", "name"],
  })

  // Feature usage
  businessLogger.featureUsage("ai_chat", "user123", {
    conversationId: "conv123",
    messageCount: 5,
  })
}

/**
 * Example 10: Middleware Usage
 */
export function middlewareLoggingExample() {
  // Comprehensive middleware (recommended)
  const handler = withComprehensiveLogging(async (req: any) => {
    // Your API handler logic
    return NextResponse.json({ success: true })
  })

  // Individual middleware examples
  // Note: These are for demonstration - actual usage would be in API routes
  console.log("Middleware examples available:", {
    withComprehensiveLogging: "All-in-one middleware",
    withRequestLogging: "Request/response logging",
    withPerformanceMonitoring: "Performance metrics",
    withSecurityLogging: "Security event detection",
  })
}

/**
 * Example 11: Configuration
 */
export function configurationExample() {
  // Get current configuration
  const config = getLoggingConfig()
  console.log("Log level:", config.level)
  console.log("Enable console:", config.enableConsole)

  // Get environment-specific configuration
  const envConfig = LOGGING_PRESETS.production
  console.log("Production log level:", envConfig.level)

  // Custom logger with specific context
  const customLogger = createStructuredLogger({
    component: "custom-service",
    version: "2.0.0",
  })

  customLogger.info("Custom service started")
}

/**
 * Example 12: Error Handling Patterns
 */
export function errorHandlingExample() {
  // Try-catch with structured logging
  try {
    // Some operation
    throw new Error("Operation failed")
  } catch (error) {
    structuredLogger.error(
      "Operation failed",
      {
        operation: "data_processing",
        userId: "user123",
        errorType: (error as Error).constructor.name,
      },
      error as Error,
    )
  }

  // API error handling
  try {
    // API call
  } catch (error) {
    apiLogger.requestFailed("req123", error as Error, 500, {
      endpoint: "/api/data",
      userId: "user123",
    })
  }

  // Database error handling
  try {
    // Database operation
  } catch (error) {
    databaseLogger.queryFailed("select", "users", error as Error, {
      userId: "user123",
      query: "SELECT * FROM users WHERE id = ?",
    })
  }
}

/**
 * Example 13: Context Management
 */
export function contextManagementExample() {
  // Create logger with base context
  const baseLogger = createStructuredLogger({
    service: "user-service",
    version: "1.0.0",
  })

  // Add request context
  const requestLogger = baseLogger.withRequest("req123", "POST", "/api/users")

  // Add user context
  const userLogger = requestLogger.withUser("user123", "org456")

  // Add operation context
  const operationLogger = userLogger.withOperation("create_user", "op123")

  // All logs will include all context
  operationLogger.info("User creation started", {
    email: "user@example.com",
  })
}

/**
 * Example 14: Log Levels and Filtering
 */
export function logLevelsExample() {
  // Different log levels
  structuredLogger.debug("Debug information", { data: "sensitive" })
  structuredLogger.info("General information", { status: "ok" })
  structuredLogger.warn("Warning message", { issue: "deprecated_api" })
  structuredLogger.error("Error occurred", { error: "validation_failed" })

  // Conditional logging based on level
  if (process.env.NODE_ENV === "development") {
    structuredLogger.debug("Development-only information")
  }

  // Performance-sensitive logging
  if (process.env.LOG_LEVEL === "debug") {
    structuredLogger.debug("Expensive debug operation", {
      result: "expensive operation result",
    })
  }
}

/**
 * Example 15: Integration with Existing Code
 */
export function integrationExample() {
  // Replace existing logger calls
  // OLD: logger.info("User logged in", { userId })
  // NEW: authLogger.loginSuccess(userId, "oauth")
  // Replace generic error logging
  // OLD: logger.error("Database error", { error: error.message })
  // NEW: databaseLogger.queryFailed("select", "users", error)
  // Replace API logging
  // OLD: logger.info("API request", { method, url, statusCode })
  // NEW: apiLogger.requestComplete(requestId, statusCode, duration)
}
