/**
 * HTTP Fetch Utilities
 *
 * This module provides safe HTTP request utilities with proper error handling
 * and consistent error responses across the application.
 */

/**
 * Safe fetch wrapper that throws errors for non-2xx responses
 *
 * This function wraps the native fetch API and automatically throws an error
 * for any response that is not successful (status >= 400). This provides
 * consistent error handling across the application.
 *
 * @param input - The URL or Request object to fetch
 * @param init - Optional fetch configuration
 * @returns Promise that resolves to the Response object
 * @throws Error for non-2xx responses with status and response text
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit) {
  // Make the HTTP request
  const res = await fetch(input, init)

  // Check if the response is successful (2xx status codes)
  if (!res.ok) {
    // Attempt to get the response text for error details
    const text = await res.text().catch(() => "")

    // TODO(omzification | !area/utils | !feature/errors | !type/quality | error-shape): Normalize error response shape
    //   Context: Parse JSON error bodies to a consistent { code, message } shape; integrate with AppError.
    //   labels: area/utils, feature/errors, type/quality
    //   assignees: omzification
    //   milestone: 0.0.1

    // Throw an error with the HTTP status and response text
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  return res
}

/**
 * Alias for safeFetch commonly used in applications for clarity
 *
 * This alias makes it clear that the function is intended for API calls
 * and provides consistent error handling.
 */
export const apiFetch = safeFetch
