/**
 * Web App Proxy Utilities
 *
 * Standardized proxy patterns for Next.js API routes that forward
 * requests to Vercel API functions. Eliminates code duplication
 * across proxy endpoints.
 */

import { getApiWorkerUrl } from "./api-url"
import { logger } from "./logger"

/**
 * Check if we should use enhanced logging (development or preview environments)
 */
function shouldUseEnhancedLogging(): boolean {
  return process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview"
}

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
    // Create a logger for this proxy request
    const proxyLogger = logger.child({
      component: "proxy",
      endpoint,
      method: req.method,
      userAgent: req.headers.get("user-agent"),
    })

    try {
      // Determine the API URL first
      const apiUrl = options.apiUrl || getApiWorkerUrl()

      // Get Clerk token for authentication using dynamic import
      const { auth } = await import("@clerk/nextjs/server")
      const { getToken } = await auth()
      const token = await getToken()

      // Ensure user is authenticated
      if (!token) {
        proxyLogger.warn("No Clerk token available for API request", {
          apiUrl,
          environment: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
        })
        return Response.json({ error: "Unauthorized" } as ProxyError, { status: 401 })
      }

      // Enhanced logging for development and preview
      if (shouldUseEnhancedLogging()) {
        proxyLogger.info("Making API request", {
          apiUrl,
          targetUrl: `${apiUrl}${endpoint}`,
          tokenPrefix: token.substring(0, 20),
          environment: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          hasOptions: Object.keys(options).length > 0,
        })
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
        // Read the response body once as text first
        const responseText = await response.text()
        let errorData: ProxyError

        try {
          // Try to parse the text as JSON
          errorData = JSON.parse(responseText)
        } catch (parseError) {
          // If we can't parse JSON (e.g., HTML error page), create a generic error
          proxyLogger.error("Failed to parse error response as JSON", {
            status: response.status,
            contentType: response.headers.get("content-type"),
            url: response.url,
            responsePreview: responseText.substring(0, 200),
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
          })

          // Detect Vercel preview protection/auth HTML
          const lower = responseText.toLowerCase()
          const looksLikePreviewProtection =
            lower.includes("<!doctype html") &&
            (lower.includes("authentication required") ||
              lower.includes("vercel") ||
              lower.includes("protect"))

          if (looksLikePreviewProtection) {
            errorData = {
              error: "Preview deployment blocked by protection",
              code: "PREVIEW_PROTECTION",
              details: shouldUseEnhancedLogging()
                ? `The target ${response.url} returned an HTML protection page. Ensure the API preview has public access or configure tokens.`
                : undefined,
            }
            return Response.json(errorData, { status: 401 })
          }

          errorData = {
            error: "Invalid response format",
            code: "INVALID_RESPONSE",
            details: shouldUseEnhancedLogging()
              ? `Expected JSON but received: ${responseText.substring(0, 100)}...`
              : undefined,
          }
        }
        return Response.json(errorData, { status: response.status })
      }

      // Parse and optionally transform the successful response
      const successResponseText = await response.text()

      // Enhanced logging for successful responses in development and preview
      if (shouldUseEnhancedLogging()) {
        proxyLogger.info("Received successful response", {
          status: response.status,
          contentType: response.headers.get("content-type"),
          responseSize: successResponseText.length,
          responsePreview: successResponseText.substring(0, 200),
        })
      }

      let data: any
      try {
        data = JSON.parse(successResponseText)
      } catch (parseError) {
        // If we can't parse JSON from a successful response, something is wrong
        proxyLogger.error("Failed to parse successful response as JSON", {
          status: response.status,
          contentType: response.headers.get("content-type"),
          url: response.url,
          responsePreview: successResponseText.substring(0, 200),
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        })
        return Response.json(
          {
            error: "Invalid response format",
            code: "INVALID_SUCCESS_RESPONSE",
            details: shouldUseEnhancedLogging()
              ? `Expected JSON but received: ${successResponseText.substring(0, 100)}...`
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
      const error = err instanceof Error ? err : new Error(msg)

      // Special handling for connection errors in development and preview
      if (
        shouldUseEnhancedLogging() &&
        (msg.includes("ECONNREFUSED") || msg.includes("Failed to fetch"))
      ) {
        const devApiUrl = options.apiUrl || getApiWorkerUrl()
        proxyLogger.error(
          "API server connection failed",
          {
            apiUrl: devApiUrl,
            endpoint,
            environment: process.env.NODE_ENV,
            vercelEnv: process.env.VERCEL_ENV,
            errorMessage: msg,
          },
          error,
        )
        return Response.json(
          {
            error: "API server not running",
            code: "API_SERVER_DOWN",
            details: `Cannot connect to API server at ${devApiUrl}. Please start the API development server.`,
          } as ProxyError,
          { status: 503 },
        )
      }

      proxyLogger.error(
        "Proxy request failed",
        {
          endpoint,
          errorMessage: msg,
          errorType: error.constructor.name,
          environment: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
        },
        error,
      )

      return Response.json(
        {
          error: "Proxy error",
          code: "INTERNAL_PROXY_ERROR",
          details: shouldUseEnhancedLogging() ? msg : undefined,
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
