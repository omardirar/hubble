/**
 * Logging Configuration
 *
 * Centralized configuration for logging across the application
 * with environment-based settings and log level management.
 */

// TODO: Integrate OpenTelemetry for distributed tracing
//   Context: Add OpenTelemetry SDK to capture traces, metrics, and logs with correlation across services for full observability.
//   labels: area/observability, feature/telemetry, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

/**
 * Log levels in order of severity
 */
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const

export type LogLevel = keyof typeof LOG_LEVELS

/**
 * Logging configuration interface
 */
export interface LoggingConfig {
  level: LogLevel
  enableConsole: boolean
  enableStructured: boolean
  enablePerformance: boolean
  enableSecurity: boolean
  enableDatabase: boolean
  enableApi: boolean
  enableConnect: boolean
  enableChat: boolean
  enableAuth: boolean
  maxLogSize: number
  logRetentionDays: number
  enableRequestLogging: boolean
  enableErrorLogging: boolean
  enablePerformanceLogging: boolean
  enableSecurityLogging: boolean
}

/**
 * Default logging configuration
 */
export const defaultConfig: LoggingConfig = {
  level: "INFO",
  enableConsole: true,
  enableStructured: true,
  enablePerformance: true,
  enableSecurity: true,
  enableDatabase: true,
  enableApi: true,
  enableConnect: true,
  enableChat: true,
  enableAuth: true,
  maxLogSize: 10 * 1024 * 1024, // 10MB
  logRetentionDays: 30,
  enableRequestLogging: true,
  enableErrorLogging: true,
  enablePerformanceLogging: true,
  enableSecurityLogging: true,
}

/**
 * Get logging configuration from environment variables
 */
export function getLoggingConfig(): LoggingConfig {
  const config = { ...defaultConfig }

  // Log level from environment
  const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel
  if (envLevel && LOG_LEVELS.hasOwnProperty(envLevel)) {
    config.level = envLevel
  }

  // Feature flags from environment
  config.enableConsole = process.env.LOG_ENABLE_CONSOLE !== "false"
  config.enableStructured = process.env.LOG_ENABLE_STRUCTURED !== "false"
  config.enablePerformance = process.env.LOG_ENABLE_PERFORMANCE !== "false"
  config.enableSecurity = process.env.LOG_ENABLE_SECURITY !== "false"
  config.enableDatabase = process.env.LOG_ENABLE_DATABASE !== "false"
  config.enableApi = process.env.LOG_ENABLE_API !== "false"
  config.enableConnect = process.env.LOG_ENABLE_CONNECT !== "false"
  config.enableChat = process.env.LOG_ENABLE_CHAT !== "false"
  config.enableAuth = process.env.LOG_ENABLE_AUTH !== "false"

  // Request logging
  config.enableRequestLogging = process.env.LOG_ENABLE_REQUEST !== "false"
  config.enableErrorLogging = process.env.LOG_ENABLE_ERROR !== "false"
  config.enablePerformanceLogging = process.env.LOG_ENABLE_PERFORMANCE !== "false"
  config.enableSecurityLogging = process.env.LOG_ENABLE_SECURITY !== "false"

  // Log size and retention
  if (process.env.LOG_MAX_SIZE) {
    config.maxLogSize = parseInt(process.env.LOG_MAX_SIZE, 10)
  }

  if (process.env.LOG_RETENTION_DAYS) {
    config.logRetentionDays = parseInt(process.env.LOG_RETENTION_DAYS, 10)
  }

  return config
}

/**
 * Check if a log level should be output based on configuration
 */
export function shouldLog(level: LogLevel, config: LoggingConfig = getLoggingConfig()): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level]
}

/**
 * Check if a component should be logged based on configuration
 */
export function shouldLogComponent(
  component: string,
  config: LoggingConfig = getLoggingConfig(),
): boolean {
  switch (component) {
    case "performance":
      return config.enablePerformance
    case "security":
      return config.enableSecurity
    case "database":
      return config.enableDatabase
    case "api":
      return config.enableApi
    case "connect":
      return config.enableConnect
    case "chat":
      return config.enableChat
    case "auth":
      return config.enableAuth
    default:
      return true
  }
}

/**
 * Get log format based on environment
 */
export function getLogFormat(): "json" | "text" {
  return process.env.NODE_ENV === "production" ? "json" : "text"
}

/**
 * Get log output destination
 */
export function getLogOutput(): "console" | "file" | "both" {
  const envOutput = process.env.LOG_OUTPUT?.toLowerCase()
  switch (envOutput) {
    case "file":
      return "file"
    case "both":
      return "both"
    default:
      return "console"
  }
}

/**
 * Log configuration validation
 */
export function validateLoggingConfig(config: LoggingConfig): string[] {
  const errors: string[] = []

  if (!LOG_LEVELS.hasOwnProperty(config.level)) {
    errors.push(`Invalid log level: ${config.level}`)
  }

  if (config.maxLogSize <= 0) {
    errors.push("Max log size must be positive")
  }

  if (config.logRetentionDays <= 0) {
    errors.push("Log retention days must be positive")
  }

  return errors
}

/**
 * Environment-specific logging presets
 */
export const LOGGING_PRESETS = {
  development: {
    level: "DEBUG" as LogLevel,
    enableConsole: true,
    enableStructured: true,
    enablePerformance: true,
    enableSecurity: true,
    enableDatabase: true,
    enableApi: true,
    enableConnect: true,
    enableChat: true,
    enableAuth: true,
    enableRequestLogging: true,
    enableErrorLogging: true,
    enablePerformanceLogging: true,
    enableSecurityLogging: true,
  },

  staging: {
    level: "INFO" as LogLevel,
    enableConsole: true,
    enableStructured: true,
    enablePerformance: true,
    enableSecurity: true,
    enableDatabase: true,
    enableApi: true,
    enableConnect: true,
    enableChat: true,
    enableAuth: true,
    enableRequestLogging: true,
    enableErrorLogging: true,
    enablePerformanceLogging: true,
    enableSecurityLogging: true,
  },

  production: {
    level: "WARN" as LogLevel,
    enableConsole: false,
    enableStructured: true,
    enablePerformance: false,
    enableSecurity: true,
    enableDatabase: true,
    enableApi: true,
    enableConnect: true,
    enableChat: true,
    enableAuth: true,
    enableRequestLogging: true,
    enableErrorLogging: true,
    enablePerformanceLogging: false,
    enableSecurityLogging: true,
  },

  testing: {
    level: "ERROR" as LogLevel,
    enableConsole: false,
    enableStructured: false,
    enablePerformance: false,
    enableSecurity: false,
    enableDatabase: false,
    enableApi: false,
    enableConnect: false,
    enableChat: false,
    enableAuth: false,
    enableRequestLogging: false,
    enableErrorLogging: false,
    enablePerformanceLogging: false,
    enableSecurityLogging: false,
  },
} as const

/**
 * Get logging configuration for current environment
 */
export function getEnvironmentConfig(): LoggingConfig {
  const env = process.env.NODE_ENV || "development"
  const preset = LOGGING_PRESETS[env as keyof typeof LOGGING_PRESETS] || LOGGING_PRESETS.development

  return {
    ...defaultConfig,
    ...preset,
  }
}
