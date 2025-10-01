/**
 * Specialized Loggers
 *
 * Domain-specific loggers for different parts of the application
 * with consistent patterns and context management.
 */

import { createStructuredLogger, LogContext, LogMessages } from "../core/structured-logger"

/**
 * API Logger for request/response logging
 */
export class ApiLogger {
  private logger = createStructuredLogger({ component: "api" })

  /**
   * Log API request start
   */
  requestStart(requestId: string, method: string, url: string, context: LogContext = {}) {
    this.logger.info(LogMessages.API_REQUEST_STARTED, {
      requestId,
      method,
      url,
      ...context,
    })
  }

  /**
   * Log API request completion
   */
  requestComplete(
    requestId: string,
    statusCode: number,
    duration: number,
    context: LogContext = {},
  ) {
    this.logger.info(LogMessages.API_REQUEST_COMPLETED, {
      requestId,
      statusCode,
      duration,
      ...context,
    })
  }

  /**
   * Log API request failure
   */
  requestFailed(requestId: string, error: Error, statusCode: number, context: LogContext = {}) {
    this.logger.error(
      LogMessages.API_REQUEST_FAILED,
      {
        requestId,
        statusCode,
        error: error.message,
        ...context,
      },
      error,
    )
  }

  /**
   * Log validation errors
   */
  validationFailed(requestId: string, errors: any[], context: LogContext = {}) {
    this.logger.warn(LogMessages.API_VALIDATION_FAILED, {
      requestId,
      errors,
      ...context,
    })
  }

  /**
   * Log authentication failures
   */
  authFailed(requestId: string, reason: string, context: LogContext = {}) {
    this.logger.warn(LogMessages.API_AUTHENTICATION_FAILED, {
      requestId,
      reason,
      ...context,
    })
  }

  /**
   * Log authorization failures
   */
  authorizationFailed(
    requestId: string,
    userId: string,
    resource: string,
    context: LogContext = {},
  ) {
    this.logger.warn(LogMessages.API_AUTHORIZATION_FAILED, {
      requestId,
      userId,
      resource,
      ...context,
    })
  }
}

/**
 * Database Logger for database operations
 */
export class DatabaseLogger {
  private logger = createStructuredLogger({ component: "database" })

  /**
   * Log database query start
   */
  queryStart(operation: string, table: string, context: LogContext = {}) {
    this.logger.debug(LogMessages.DB_QUERY_STARTED, {
      operation,
      table,
      ...context,
    })
  }

  /**
   * Log database query completion
   */
  queryComplete(
    operation: string,
    table: string,
    duration: number,
    rowCount?: number,
    context: LogContext = {},
  ) {
    this.logger.debug(LogMessages.DB_QUERY_COMPLETED, {
      operation,
      table,
      duration,
      ...(rowCount !== undefined && { rowCount }),
      ...context,
    })
  }

  /**
   * Log database query failure
   */
  queryFailed(operation: string, table: string, error: Error, context: LogContext = {}) {
    this.logger.error(
      LogMessages.DB_QUERY_FAILED,
      {
        operation,
        table,
        error: error.message,
        ...context,
      },
      error,
    )
  }

  /**
   * Log database connection issues
   */
  connectionFailed(error: Error, context: LogContext = {}) {
    this.logger.error(
      LogMessages.DB_CONNECTION_FAILED,
      {
        error: error.message,
        ...context,
      },
      error,
    )
  }

  /**
   * Log transaction events
   */
  transactionStart(transactionId: string, context: LogContext = {}) {
    this.logger.debug(LogMessages.DB_TRANSACTION_STARTED, {
      transactionId,
      ...context,
    })
  }

  transactionCommit(transactionId: string, duration: number, context: LogContext = {}) {
    this.logger.debug(LogMessages.DB_TRANSACTION_COMMITTED, {
      transactionId,
      duration,
      ...context,
    })
  }

  transactionRollback(transactionId: string, reason: string, context: LogContext = {}) {
    this.logger.warn(LogMessages.DB_TRANSACTION_ROLLED_BACK, {
      transactionId,
      reason,
      ...context,
    })
  }
}

/**
 * Connect Logger for data connection operations
 */
export class ConnectLogger {
  private logger = createStructuredLogger({ component: "connect" })

  /**
   * Log provisioning start
   */
  provisionStart(correlationId: string, orgId: string, context: LogContext = {}) {
    this.logger.info(LogMessages.CONNECT_PROVISION_STARTED, {
      correlationId,
      orgId,
      ...context,
    })
  }

  /**
   * Log provisioning completion
   */
  provisionComplete(
    correlationId: string,
    orgId: string,
    duration: number,
    context: LogContext = {},
  ) {
    this.logger.info(LogMessages.CONNECT_PROVISION_COMPLETED, {
      correlationId,
      orgId,
      duration,
      ...context,
    })
  }

  /**
   * Log provisioning failure
   */
  provisionFailed(correlationId: string, orgId: string, error: Error, context: LogContext = {}) {
    this.logger.error(
      LogMessages.CONNECT_PROVISION_FAILED,
      {
        correlationId,
        orgId,
        error: error.message,
        ...context,
      },
      error,
    )
  }

  /**
   * Log lock acquisition
   */
  lockAcquired(correlationId: string, lockKey: string, context: LogContext = {}) {
    this.logger.info(LogMessages.CONNECT_LOCK_ACQUIRED, {
      correlationId,
      lockKey,
      ...context,
    })
  }

  /**
   * Log lock release
   */
  lockReleased(correlationId: string, lockKey: string, context: LogContext = {}) {
    this.logger.info(LogMessages.CONNECT_LOCK_RELEASED, {
      correlationId,
      lockKey,
      ...context,
    })
  }

  /**
   * Log lock failure
   */
  lockFailed(correlationId: string, lockKey: string, reason: string, context: LogContext = {}) {
    this.logger.warn(LogMessages.CONNECT_LOCK_FAILED, {
      correlationId,
      lockKey,
      reason,
      ...context,
    })
  }

  /**
   * Log step progress
   */
  stepProgress(correlationId: string, step: string, status: string, context: LogContext = {}) {
    this.logger.info("connect.provision.step.progress", {
      correlationId,
      step,
      status,
      ...context,
    })
  }

  /**
   * Log step completion
   */
  stepComplete(correlationId: string, step: string, duration: number, context: LogContext = {}) {
    this.logger.info("connect.provision.step.completed", {
      correlationId,
      step,
      duration,
      ...context,
    })
  }

  /**
   * Log step failure
   */
  stepFailed(correlationId: string, step: string, error: Error, context: LogContext = {}) {
    this.logger.error(
      "connect.provision.step.failed",
      {
        correlationId,
        step,
        error: error.message,
        ...context,
      },
      error,
    )
  }
}

/**
 * Chat Logger for chat operations
 */
export class ChatLogger {
  private logger = createStructuredLogger({ component: "chat" })

  /**
   * Log message sent
   */
  messageSent(
    conversationId: string,
    userId: string,
    messageLength: number,
    context: LogContext = {},
  ) {
    this.logger.info(LogMessages.CHAT_MESSAGE_SENT, {
      conversationId,
      userId,
      messageLength,
      ...context,
    })
  }

  /**
   * Log message received
   */
  messageReceived(conversationId: string, messageLength: number, context: LogContext = {}) {
    this.logger.info(LogMessages.CHAT_MESSAGE_RECEIVED, {
      conversationId,
      messageLength,
      ...context,
    })
  }

  /**
   * Log conversation created
   */
  conversationCreated(
    conversationId: string,
    userId: string,
    title: string,
    context: LogContext = {},
  ) {
    this.logger.info(LogMessages.CHAT_CONVERSATION_CREATED, {
      conversationId,
      userId,
      title,
      ...context,
    })
  }

  /**
   * Log conversation loaded
   */
  conversationLoaded(conversationId: string, messageCount: number, context: LogContext = {}) {
    this.logger.info(LogMessages.CHAT_CONVERSATION_LOADED, {
      conversationId,
      messageCount,
      ...context,
    })
  }

  /**
   * Log chat error
   */
  chatError(operation: string, error: Error, context: LogContext = {}) {
    this.logger.error(
      "chat.error",
      {
        operation,
        error: error.message,
        ...context,
      },
      error,
    )
  }

  /**
   * Log AI response generation
   */
  aiResponseStart(conversationId: string, promptLength: number, context: LogContext = {}) {
    this.logger.info("chat.ai.response.start", {
      conversationId,
      promptLength,
      ...context,
    })
  }

  /**
   * Log AI response completion
   */
  aiResponseComplete(
    conversationId: string,
    responseLength: number,
    duration: number,
    context: LogContext = {},
  ) {
    this.logger.info("chat.ai.response.complete", {
      conversationId,
      responseLength,
      duration,
      ...context,
    })
  }
}

/**
 * Auth Logger for authentication operations
 */
export class AuthLogger {
  private logger = createStructuredLogger({ component: "auth" })

  /**
   * Log login attempt
   */
  loginAttempt(userId: string, method: string, context: LogContext = {}) {
    this.logger.info(LogMessages.AUTH_LOGIN_ATTEMPT, {
      userId,
      method,
      ...context,
    })
  }

  /**
   * Log login success
   */
  loginSuccess(userId: string, method: string, context: LogContext = {}) {
    this.logger.info(LogMessages.AUTH_LOGIN_SUCCESS, {
      userId,
      method,
      ...context,
    })
  }

  /**
   * Log login failure
   */
  loginFailed(userId: string, method: string, reason: string, context: LogContext = {}) {
    this.logger.warn(LogMessages.AUTH_LOGIN_FAILED, {
      userId,
      method,
      reason,
      ...context,
    })
  }

  /**
   * Log logout
   */
  logout(userId: string, context: LogContext = {}) {
    this.logger.info(LogMessages.AUTH_LOGOUT, {
      userId,
      ...context,
    })
  }

  /**
   * Log token refresh
   */
  tokenRefreshed(userId: string, context: LogContext = {}) {
    this.logger.info(LogMessages.AUTH_TOKEN_REFRESHED, {
      userId,
      ...context,
    })
  }

  /**
   * Log authentication error
   */
  authError(operation: string, error: Error, context: LogContext = {}) {
    this.logger.error(
      "auth.error",
      {
        operation,
        error: error.message,
        ...context,
      },
      error,
    )
  }
}

/**
 * Export specialized logger instances
 */
export const apiLogger = new ApiLogger()
export const databaseLogger = new DatabaseLogger()
export const connectLogger = new ConnectLogger()
export const chatLogger = new ChatLogger()
export const authLogger = new AuthLogger()
