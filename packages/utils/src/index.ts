/**
 * Hubble Utils Package - Main Export
 *
 * This package provides shared utility functions used across the Hubble application.
 * It includes utilities for HTTP requests, error handling, styling, ID generation,
 * and chat functionality.
 *
 * Modules:
 * - fetch: HTTP request utilities with error handling
 * - errors: Custom error classes and error handling utilities
 * - cn: Class name utility for conditional styling (clsx + tailwind-merge)
 * - id: ID generation utilities (UUID, nanoid, etc.)
 * - chat: Chat-specific utility functions
 */

// Re-export client-safe utilities for backward compatibility
export * from "./client"
export * from "./cn"
export * from "./fetch"
export * from "./id"
export * from "./logger"
export * from "./chat"
// Server-only modules (qstash/redis/db ops) are available under "@hubble/utils/server"
