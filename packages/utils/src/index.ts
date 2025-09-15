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

export * from "./fetch" // HTTP request utilities
export * from "./errors" // Error handling utilities
export * from "./cn" // Class name utilities
export * from "./id" // ID generation utilities
export * from "./chat" // Chat utilities
export * from "./api-url" // API URL resolution utilities

// NOTE: For server-only utilities (api-middleware, rate-limit, logger, proxy),
// import from "@hubble/utils/server" instead to avoid client-side bundling issues
