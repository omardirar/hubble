/**
 * URL Utilities
 *
 * This module provides utilities for working with URLs, including
 * constructing URLs from request headers and handling protocol detection.
 */

/**
 * Extract the base URL from request headers
 *
 * This function constructs a base URL from request headers, handling
 * forwarded headers from proxies and load balancers.
 *
 * @param headers - Request headers object
 * @returns The base URL (e.g., "https://example.com")
 *
 * @example
 * ```typescript
 * const baseUrl = getBaseUrlFromHeaders(request.headers)
 * const targetUrl = new URL("/api/endpoint", baseUrl).toString()
 * ```
 */
export function getBaseUrlFromHeaders(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000"
  const protocol = (headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https")) as "http" | "https"
  return `${protocol}://${host}`
}

/**
 * Construct a target URL for API endpoints
 *
 * This function creates a complete URL for API endpoints using the
 * base URL from headers and the provided path.
 *
 * @param headers - Request headers object
 * @param path - API path (e.g., "/api/queues/provision")
 * @returns The complete target URL
 *
 * @example
 * ```typescript
 * const targetUrl = buildApiUrl(request.headers, "/api/queues/provision")
 * // "https://example.com/api/queues/provision"
 * ```
 */
export function buildApiUrl(headers: Headers, path: string): string {
  const baseUrl = getBaseUrlFromHeaders(headers)
  return new URL(path, baseUrl).toString()
}

/**
 * Check if a URL is a localhost URL
 *
 * @param url - URL to check
 * @returns True if the URL is localhost
 *
 * @example
 * ```typescript
 * isLocalhost("http://localhost:3000") // true
 * isLocalhost("https://example.com") // false
 * ```
 */
export function isLocalhost(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

/**
 * Safely parse a URL string
 *
 * @param url - URL string to parse
 * @returns Parsed URL or null if invalid
 *
 * @example
 * ```typescript
 * const url = safeParseUrl("https://example.com")
 * if (url) {
 *   console.log(url.hostname) // "example.com"
 * }
 * ```
 */
export function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}
