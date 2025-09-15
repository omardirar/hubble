/**
 * API URL Utilities
 *
 * This module provides utilities for determining the correct API URL
 * using Vercel's Related Projects feature for monorepo integration.
 *
 * Features:
 * - Vercel Related Projects integration
 * - Environment-aware URL resolution
 * - Fallback to default URLs
 * - Centralized configuration
 * - Type-safe implementation
 */

import { withRelatedProject } from "@vercel/related-projects"

/**
 * Get the API functions URL using Vercel Related Projects
 *
 * This function uses Vercel's Related Projects feature to automatically
 * resolve the correct API URL based on the deployment environment.
 * In development, it uses the local Vercel dev server. In production,
 * it uses the related project's URL.
 *
 * @param fallbackUrl - Optional fallback URL if related project is not available
 * @returns The appropriate API functions URL for the current environment
 *
 * @example
 * ```ts
 * // In development: returns "http://localhost:3001"
 * // In production: returns related project URL or fallback
 * const apiUrl = getApiWorkerUrl()
 * const response = await fetch(`${apiUrl}/v1/chat`)
 * ```
 */
export function getApiWorkerUrl(fallbackUrl?: string): string {
  // Use local Vercel dev server URL in development
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001"
  }

  // In production, use Vercel Related Projects
  try {
    return withRelatedProject({
      projectName: "hubble-api",
      defaultHost: fallbackUrl || "https://hubble-api-preview.vercel.app",
    })
  } catch (error) {
    // Fallback to environment variable or default if related projects fail
    return (
      process.env.NEXT_PUBLIC_API_BASE_URL || fallbackUrl || "https://hubble-api-preview.vercel.app"
    )
  }
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
