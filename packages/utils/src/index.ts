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
