/**
 * Supabase REST API Client
 *
 * This module provides a lightweight REST client for Supabase that bypasses
 * the official Supabase client library. It's useful for scenarios where you
 * need direct control over HTTP requests or when the full client is not available.
 *
 * Features:
 * - Direct HTTP requests to Supabase REST API
 * - Automatic header management (auth, API key, content-type)
 * - URL building and path normalization
 * - Support for GET, POST, PATCH methods
 * - Custom header merging
 */

type HeadersInput = HeadersInit | undefined

/**
 * Supabase REST client interface
 *
 * This interface defines the methods available on the Supabase REST client.
 * It provides a simple, fetch-like API for making requests to Supabase.
 */
export type SupabaseRest = {
  /** Generic request method */
  request: (path: string, init?: RequestInit) => Promise<Response>
  /** GET request method */
  get: (path: string, init?: RequestInit) => Promise<Response>
  /** POST request method */
  post: (path: string, body?: unknown, init?: RequestInit) => Promise<Response>
  /** PATCH request method */
  patch: (path: string, body?: unknown, init?: RequestInit) => Promise<Response>
  /** Get merged headers for requests */
  headers: (extra?: HeadersInput) => HeadersInit
}

/**
 * Create a Supabase REST client
 *
 * This function creates a REST client for making direct HTTP requests to
 * Supabase. It handles URL building, header management, and provides
 * convenient methods for common HTTP operations.
 *
 * @param args - Configuration for the REST client
 * @param args.url - Supabase project URL
 * @param args.anonKey - Supabase anonymous key
 * @param args.token - JWT token for authentication
 * @returns SupabaseRest client instance
 *
 * @example
 * ```ts
 * const client = createSupabaseRest({
 *   url: "https://project.supabase.co",
 *   anonKey: "anon_key_here",
 *   token: "jwt_token_here"
 * })
 *
 * const response = await client.get("/rest/v1/users")
 * ```
 */
export function createSupabaseRest(args: {
  url: string
  anonKey: string
  token: string
}): SupabaseRest {
  // Normalize the base URL by removing trailing slashes
  const base = args.url.replace(/\/+$/, "")

  // TODO: Add retry with exponential backoff for 5xx/429
  //   Context: Improve resilience to transient failures; respect Retry-After, jitter, and AbortSignal.
  //   labels: area/utils, feature/http, type/quality
  //   assignees: omzification
  //   milestone: 0.0.1

  /**
   * Merge base headers with any additional headers
   *
   * @param extra - Additional headers to merge
   * @returns Merged headers object
   */
  function mergeHeaders(extra?: HeadersInput): HeadersInit {
    // Base headers required for Supabase REST API
    const baseHeaders: Record<string, string> = {
      Authorization: `Bearer ${args.token}`, // JWT token for authentication
      apikey: args.anonKey, // Supabase anonymous key
      "content-type": "application/json", // JSON content type
      Prefer: "return=representation", // Return full representation
    }

    if (!extra) return baseHeaders

    // Merge any provided headers on top of base headers
    const result = new Headers(baseHeaders as HeadersInit)
    const provided = new Headers(extra as HeadersInit)
    provided.forEach((value, key) => result.set(key, value))
    return result
  }

  /**
   * Build the full URL for a request
   *
   * @param path - The path to append to the base URL
   * @returns Complete URL for the request
   */
  function buildUrl(path: string): string {
    // If path is already a full URL, return it as-is
    if (/^https?:\/\//i.test(path)) return path
    // Otherwise, append to base URL with proper path separator
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`
  }

  /**
   * Generic request method
   *
   * @param path - The path to request
   * @param init - Request initialization options
   * @returns Promise that resolves to the response
   */
  async function request(path: string, init?: RequestInit): Promise<Response> {
    const url = buildUrl(path)
    const headers = mergeHeaders(init?.headers)
    return fetch(url, { ...init, headers })
  }

  // TODO: Expose typed JSON parser helpers
  //   Context: Provide json<T>() wrapper that validates shapes and surfaces parsing errors clearly.
  //   labels: area/utils, feature/types, type/quality
  //   assignees: omzification
  //   milestone: 0.0.1

  // Convenience methods for common HTTP operations
  const get = (path: string, init?: RequestInit) => request(path, { ...init, method: "GET" })
  const post = (path: string, body?: unknown, init?: RequestInit) =>
    request(path, {
      ...init,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const patch = (path: string, body?: unknown, init?: RequestInit) =>
    request(path, {
      ...init,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  return { request, get, post, patch, headers: mergeHeaders }
}
