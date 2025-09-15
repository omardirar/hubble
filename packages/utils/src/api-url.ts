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
  // Use local Vercel dev server URL in development
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001"
  }

  // In production/preview, use Vercel Related Projects
  try {
    // Use Related Projects. Library supports name-based resolution at runtime.
    const relatedProjectUrl = withRelatedProject({
      projectName: "hubble-api",
      defaultHost: fallbackUrl || "https://hubble-api.vercel.app",
    })

    // If we accidentally resolve to a web project preview domain, correct it
    // Known bad pattern: hubble-api-git-<branch>-hubble-app.vercel.app (web project suffix)
    const host = relatedProjectUrl.replace(/^https?:\/\//, "")
    const seemsLikeWebPreview = host.includes("hubble-app.vercel.app")

    // Log the resolved URL for debugging (preview only)
    if (process.env.VERCEL_ENV === "preview") {
      logger.info("Related project URL resolved", {
        component: "api-url",
        resolvedUrl: relatedProjectUrl,
        environment: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        seemsLikeWebPreview,
      })
    }

    if (seemsLikeWebPreview) {
      const chosen =
        fallbackUrl || process.env.NEXT_PUBLIC_API_BASE_URL || "https://hubble-api.vercel.app"
      logger.warn("Using API URL fallback due to web preview host detection", {
        component: "api-url",
        chosen,
      })
      return chosen
    }

    return relatedProjectUrl
  } catch (error) {
    logger.warn("Failed to resolve related project URL", {
      component: "api-url",
      error: error instanceof Error ? error.message : String(error),
    })

    // For preview environments, try to use a more reliable fallback
    if (process.env.VERCEL_ENV === "preview") {
      const previewFallback =
        process.env.NEXT_PUBLIC_API_BASE_URL || "https://hubble-api.vercel.app"
      logger.info("Using preview API fallback", {
        component: "api-url",
        previewFallback,
      })
      return previewFallback
    }

    // Fallback to environment variable or default if related projects fail
    const chosen =
      process.env.NEXT_PUBLIC_API_BASE_URL || fallbackUrl || "https://hubble-api.vercel.app"
    logger.info("Using default API fallback", { component: "api-url", chosen })
    return chosen
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
  PREVIEW: "https://hubble-api-git-main.vercel.app",
  /** Production environment API URL */
  PRODUCTION: "https://hubble-api.vercel.app",
} as const
