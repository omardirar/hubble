/**
 * HTTP Fetch Utilities
 *
 * This module provides safe HTTP request utilities with proper error handling,
 * timeouts, and consistent error responses across the application.
 */

import { logger } from "@hubble/logger"

/**
 * HTTP request options with timeout support
 */
export interface HttpOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

/**
 * HTTP fetch wrapper with timeout and proper error handling
 *
 * @param url - The URL to fetch
 * @param options - HTTP options including method, headers, body, and timeout
 * @returns Promise that resolves to the Response object
 * @throws Error for network errors, timeouts, or non-2xx responses
 */
export async function httpFetch(url: string, options: HttpOptions = {}): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000)

  try {
    // Debug logging for HTTP requests
    logger.debug("http.fetch.request", {
      url,
      method: options.method ?? "GET",
      headers: options.headers ?? {},
      body: options.body,
      body_type: typeof options.body,
      body_length: options.body?.length || 0,
    })

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(options.headers ?? {}),
      },
      body: options.body,
      signal: controller.signal,
    })

    logger.debug("http.fetch.response", {
      url,
      status: response.status,
      status_text: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })

    return response
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${options.timeoutMs ?? 15000}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

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

    // Throw an error with the HTTP status and response text
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  return res
}

// TODO: Add request/response caching
//   Context: Implement intelligent caching for GET requests to reduce API calls and improve performance.
//   labels: area/utils, feature/performance, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

/**
 * Fetch with retry logic for transient failures
 * @param input - The URL or Request object
 * @param init - Optional request configuration
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Promise resolving to Response object
 * @throws Error for non-2xx responses after all retries
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries: number = 3,
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init)

      // Retry on 5xx errors (server errors) but not on 4xx errors (client errors)
      if (response.ok || response.status < 500) {
        return response
      }

      if (attempt === maxRetries) {
        return response // Return the last response if we've exhausted retries
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // Max 10 seconds
      await new Promise((resolve) => setTimeout(resolve, delay))
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        throw lastError
      }

      // Wait before retrying
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error("Max retries exceeded")
}

/**
 * Alias for safeFetch commonly used in applications for clarity
 *
 * This alias makes it clear that the function is intended for API calls
 * and provides consistent error handling.
 */
export const apiFetch = safeFetch

/**
 * Creates a basic auth header from username and password
 *
 * @param username - The username for basic auth
 * @param password - The password for basic auth
 * @returns Basic auth header string
 */
export function createBasicAuthHeader(username: string, password: string): string {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
}

/**
 * Creates a bearer auth header from a token
 *
 * @param token - The bearer token
 * @returns Bearer auth header string
 */
export function createBearerAuthHeader(token: string): string {
  return `Bearer ${token}`
}
