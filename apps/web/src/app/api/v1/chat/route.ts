import { auth } from "@clerk/nextjs/server"
import { getApiWorkerUrl } from "@hubble/utils"

/**
 * Web App API Route: Chat Proxy
 *
 * This Next.js API route acts as a proxy between the web application and the
 * API worker. It forwards chat requests to the centralized API worker which
 * handles all the business logic and database operations.
 *
 * Architecture:
 * - Web app → Next.js API route → API worker → Anthropic API
 * - JWT tokens are propagated for user authentication
 * - All sensitive operations are handled by the API worker
 * - This route only handles request/response proxying
 *
 * Security:
 * - No direct database access (prevents RLS bypass)
 * - JWT tokens forwarded to API worker for user context
 * - API worker handles all secret management
 * - Error responses don't expose sensitive information
 */

/**
 * Handle POST requests to /api/v1/chat
 *
 * This function proxies chat requests from the web application to the API worker.
 * It authenticates the user via Clerk, retrieves their JWT token, and forwards
 * the request with proper authentication to the API worker.
 *
 * @param req - The incoming Next.js request object
 * @returns Promise that resolves to a Next.js response
 */
export async function POST(req: Request) {
  try {
    // Get Clerk token for authentication
    const { getToken } = await auth()
    const token = await getToken()

    // Ensure user is authenticated
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse the request body, with fallback to empty object if parsing fails
    const body = await req.json().catch(() => ({}))

    // Determine the API worker URL from environment variables
    const apiUrl = getApiWorkerUrl()

    // Forward the request to the API worker with proper authentication
    const response = await fetch(`${apiUrl}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the Clerk JWT token for user authentication
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body), // Forward the request body
    })

    // Handle API worker errors
    if (!response.ok) {
      // Try to parse error response from API worker, fallback to generic error
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      return Response.json(errorData, { status: response.status })
    }

    // Parse and return the successful response from the API worker
    const data = await response.json()
    return Response.json(data)
  } catch (err) {
    // Handle unexpected errors (network issues, parsing errors, etc.)
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: "Unexpected error", detail: msg }, { status: 500 })
  }
}
