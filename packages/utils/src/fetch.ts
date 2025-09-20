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
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {}),
      },
      body: options.body,
      signal: controller.signal,
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
