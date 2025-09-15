/**
 * API URL Utilities
 *
 * This module provides utilities for determining the correct API URL
 * using Vercel System Environment Variables for environment-aware resolution.
 *
 * Features:
 * - Vercel Related Projects integration
 * - Environment-aware URL resolution
 * - Fallback to default URLs
 * - Centralized configuration
 * - Type-safe implementation
 */

import { logger } from "./logger"

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
  // Development: local API dev server
  if (process.env.NODE_ENV === "development") {
    return API_URLS.LOCAL
  }

  const env = process.env.VERCEL_ENV // production | preview | development

  // Production: return production API URL
  if (env === "production") {
    logger.info("Resolved API URL for production", {
      component: "api-url",
      chosen: API_URLS.PRODUCTION,
    })
    return API_URLS.PRODUCTION
  }

  // Preview: best-effort derivation using VERCEL_URL; fall back safely
  if (env === "preview") {
    const branchHost = process.env.VERCEL_URL // e.g. webproject-git-branch-team.vercel.app
    if (branchHost) {
      const derived = `https://${branchHost}`
      logger.info("Derived preview API URL from VERCEL_URL", {
        component: "api-url",
        branchHost,
        derived,
      })
      return derived
    }

    // If branch URL is unavailable, use explicit env override or stable fallback
    const chosen =
      process.env.NEXT_PUBLIC_API_BASE_URL || fallbackUrl || API_URLS.PREVIEW || API_URLS.PRODUCTION
    logger.warn("Using preview API fallback (no branch host)", {
      component: "api-url",
      chosen,
    })
    return chosen
  }

  // Unknown env: choose safest default
  const chosen = process.env.NEXT_PUBLIC_API_BASE_URL || fallbackUrl || API_URLS.PRODUCTION
  logger.warn("Using default API URL (unknown env)", { component: "api-url", chosen, env })
  return chosen
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
  PREVIEW: "https://hubble-api-git-main.vercel.app",
  /** Production environment API URL */
  PRODUCTION: "https://hubble-api.vercel.app",
} as const
