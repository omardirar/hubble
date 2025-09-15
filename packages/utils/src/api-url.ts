/**
 * API URL Utilities
 *
 * This module provides utilities for determining the correct API URL
 * based on the current environment (development vs production).
 *
 * Features:
 * - Environment-aware URL resolution
 * - Fallback to default URLs
 * - Centralized configuration
 * - Type-safe implementation
 */

/**
 * Get the API functions URL based on the current environment
 *
 * This function determines the correct API functions URL to use based on
 * the current environment. In development, it uses the local Vercel dev server
 * running on localhost:3001. In production, it uses the configured
 * environment variable or falls back to the preview URL.
 *
 * @param fallbackUrl - Optional fallback URL if environment variable is not set
 * @returns The appropriate API functions URL for the current environment
 *
 * @example
 * ```ts
 * // In development: returns "http://localhost:3001"
 * // In production: returns process.env.NEXT_PUBLIC_API_BASE_URL or fallback
 * const apiUrl = getApiWorkerUrl()
 * const response = await fetch(`${apiUrl}/v1/chat`)
 * ```
 */
export function getApiWorkerUrl(fallbackUrl?: string): string {
  // Use local Vercel dev server URL in development
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001"
  }

  // In production, use environment variable or fallback
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL || fallbackUrl || "https://hubble-api-preview.vercel.app"
  )
}

/**
 * Default API functions URLs for different environments
 *
 * These constants provide the default URLs for each environment,
 * making it easy to maintain and update them in one place.
 */
export const API_URLS = {
  /** Local development API server URL */
  LOCAL: "http://localhost:3001",
  /** Preview environment API URL */
  PREVIEW: "https://hubble-api-preview.vercel.app",
  /** Production environment API URL */
  PRODUCTION: "https://hubble-api.vercel.app",
} as const
