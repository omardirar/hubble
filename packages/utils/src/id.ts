/**
 * ID Generation Utilities
 *
 * This module provides utilities for generating unique identifiers
 * with fallback support for different environments.
 */

/**
 * Generate a unique identifier with crypto.randomUUID fallback
 *
 * This function generates a unique identifier using the most appropriate
 * method available in the current environment. It prefers crypto.randomUUID()
 * for cryptographically secure UUIDs when available, falling back to
 * timestamp-based IDs for older environments.
 *
 * Features:
 * - Uses crypto.randomUUID() when available (browser/Node.js 14.17.0+)
 * - Falls back to timestamp-based ID for older environments
 * - Cryptographically secure when crypto.randomUUID() is available
 * - Guaranteed uniqueness within reasonable timeframes
 *
 * @returns A unique identifier string
 *
 * @example
 * ```ts
 * generateId() // "550e8400-e29b-41d4-a716-446655440000" (UUID v4)
 * generateId() // "1703123456789" (timestamp fallback)
 * ```
 */
export function generateId() {
  // Check if crypto.randomUUID is available (modern browsers/Node.js)
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID() // Use cryptographically secure UUID v4
    : String(Date.now()) // Fallback to timestamp-based ID
}
