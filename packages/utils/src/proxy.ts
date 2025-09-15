/**
 * Web App Proxy Utilities
 *
 * Standardized proxy patterns for Next.js API routes that forward
 * requests to Vercel API functions. Eliminates code duplication
 * across proxy endpoints.
 */

import { getApiWorkerUrl } from "./api-url"

export interface ProxyOptions {
  /** Override the default API base URL */
  apiUrl?: string
  /** Additional headers to include in the proxied request */
  headers?: Record<string, string>
  /** Whether to include the request body (for POST/PUT/PATCH) */
  includeBody?: boolean
  /** Transform the request body before proxying */
  transformBody?: (body: any) => any
  /** Transform the response before returning */
  transformResponse?: (data: any) => any
}

/**
 * Standard error response format
 */
export interface ProxyError {
  error: string
  code?: string
  details?: any
}

/**
 * Create a standardized proxy handler for Next.js API routes
 */
export function createProxyHandler(endpoint: string, options: ProxyOptions = {}) {
  return async function proxyHandler(req: Request) {
    try {
      // Get Clerk token for authentication using dynamic import
      const { auth } = await import("@clerk/nextjs/server")
      const { getToken } = await auth()
      const token = await getToken()

      // Ensure user is authenticated
      if (!token) {
        return Response.json({ error: "Unauthorized" } as ProxyError, { status: 401 })
      }

      // Parse the request body if needed
      let body: any = null
      if (options.includeBody !== false && ["POST", "PUT", "PATCH"].includes(req.method || "")) {
        body = await req.json().catch(() => ({}))

        // Transform body if transformer provided
        if (options.transformBody) {
          body = options.transformBody(body)
        }
      }

      // Determine the API URL
      const apiUrl = options.apiUrl || getApiWorkerUrl()

      // Prepare headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      }

      // Forward the request to the API function
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: req.method,
        headers,
        ...(body && { body: JSON.stringify(body) }),
      })

      // Handle API function errors
      if (!response.ok) {
        let errorData: ProxyError
        try {
          errorData = await response.json()
        } catch (parseError) {
          // If we can't parse JSON (e.g., HTML error page), create a generic error
          const responseText = await response.text().catch(() => "Unknown error")
          console.error(
            `Failed to parse error response as JSON. Response text: ${responseText.substring(0, 200)}...`,
          )
          errorData = {
            error: "Invalid response format",
            code: "INVALID_RESPONSE",
            details:
              process.env.NODE_ENV === "development"
                ? `Expected JSON but received: ${responseText.substring(0, 100)}...`
                : undefined,
          }
        }
        return Response.json(errorData, { status: response.status })
      }

      // Parse and optionally transform the successful response
      let data: any
      try {
        data = await response.json()
      } catch (parseError) {
        // If we can't parse JSON from a successful response, something is wrong
        const responseText = await response.text().catch(() => "Unknown response")
        console.error(
          `Failed to parse successful response as JSON. Response text: ${responseText.substring(0, 200)}...`,
        )
        return Response.json(
          {
            error: "Invalid response format",
            code: "INVALID_SUCCESS_RESPONSE",
            details:
              process.env.NODE_ENV === "development"
                ? `Expected JSON but received: ${responseText.substring(0, 100)}...`
                : undefined,
          } as ProxyError,
          { status: 502 },
        )
      }

      if (options.transformResponse) {
        data = options.transformResponse(data)
      }

      return Response.json(data)
    } catch (err) {
      // Handle unexpected errors (network issues, parsing errors, etc.)
      const msg = err instanceof Error ? err.message : String(err)

      // Special handling for connection errors in development
      if (
        process.env.NODE_ENV === "development" &&
        (msg.includes("ECONNREFUSED") || msg.includes("Failed to fetch"))
      ) {
        const devApiUrl = options.apiUrl || getApiWorkerUrl()
        console.error(`API server not running at ${devApiUrl}. Please start the API server.`)
        return Response.json(
          {
            error: "API server not running",
            code: "API_SERVER_DOWN",
            details: `Cannot connect to API server at ${devApiUrl}. Please start the API development server.`,
          } as ProxyError,
          { status: 503 },
        )
      }

      console.error(`Proxy error for ${endpoint}:`, err)

      return Response.json(
        {
          error: "Proxy error",
          code: "INTERNAL_PROXY_ERROR",
          details: process.env.NODE_ENV === "development" ? msg : undefined,
        } as ProxyError,
        { status: 500 },
      )
    }
  }
}

/**
 * Create proxy handlers for common HTTP methods
 */
export function createMethodProxies(endpoint: string, options: ProxyOptions = {}) {
  const handler = createProxyHandler(endpoint, options)

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  }
}

/**
 * Create a proxy handler with parameter extraction for dynamic routes
 */
export function createDynamicProxyHandler(endpointTemplate: string, options: ProxyOptions = {}) {
  return async function dynamicProxyHandler(
    req: Request,
    context: { params: Promise<Record<string, string>> },
  ) {
    try {
      // Extract parameters from the route
      const params = await context.params

      // Replace placeholders in the endpoint template
      let endpoint = endpointTemplate
      for (const [key, value] of Object.entries(params)) {
        endpoint = endpoint.replace(`[${key}]`, encodeURIComponent(value))
      }

      // Create a proxy handler with the resolved endpoint
      const handler = createProxyHandler(endpoint, options)
      return handler(req)
    } catch (err) {
      console.error("Dynamic proxy parameter extraction error:", err)
      return Response.json(
        {
          error: "Invalid route parameters",
          code: "INVALID_PARAMS",
        } as ProxyError,
        { status: 400 },
      )
    }
  }
}

/**
 * Utility to extract and validate route parameters
 */
export async function extractParams<T extends Record<string, string>>(
  context: { params: Promise<Record<string, string>> },
  validators?: Partial<Record<keyof T, (value: string) => boolean>>,
): Promise<T> {
  const params = (await context.params) as T

  // Validate parameters if validators provided
  if (validators) {
    for (const [key, validator] of Object.entries(validators)) {
      const value = params[key as keyof T]
      if (value && validator && !validator(value as string)) {
        throw new Error(`Invalid parameter: ${key}`)
      }
    }
  }

  return params
}
