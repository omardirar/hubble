/**
 * Web App API Route: Connection Management Proxy
 *
 * This Next.js API route handles connection management operations by proxying
 * requests to the API worker. It supports both enabling connections and checking
 * their status.
 *
 * Architecture:
 * - Web app → Next.js API route → API worker → Supabase
 * - GET: Check connection status by job ID
 * - POST: Enable new data source connections
 * - All business logic handled by the API worker
 *
 * Security:
 * - No direct database access (prevents RLS bypass)
 * - API worker handles all secret management
 * - Job IDs are validated and properly encoded
 * - Error responses don't expose sensitive information
 */

import { NextResponse } from "next/server"

/**
 * Handle GET requests to /api/v1/connect
 *
 * This function checks the status of a connection job by forwarding the request
 * to the API worker. It requires a jobId query parameter to identify the job.
 *
 * @param req - The incoming Next.js request object
 * @returns Promise that resolves to a Next.js response with job status
 */
export async function GET(req: Request) {
  try {
    // Parse the URL to extract query parameters
    const url = new URL(req.url)
    const jobId = url.searchParams.get("jobId")

    // Validate that jobId is provided
    if (!jobId) {
      return NextResponse.json({ ok: false, error: "Missing jobId" }, { status: 400 })
    }

    // Determine the API worker URL from environment variables
    const apiUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "https://hubble-api-preview.github-cc7.workers.dev"

    // Forward the status check request to the API worker
    const response = await fetch(`${apiUrl}/v1/connect/status?jobId=${encodeURIComponent(jobId)}`, {
      method: "GET",
    })

    // Handle API worker errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      return NextResponse.json(errorData, { status: response.status })
    }

    // Return the job status from the API worker
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    // Log the error for debugging
    console.error("Connect status error:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

/**
 * Handle POST requests to /api/v1/connect
 *
 * This function enables new data source connections by forwarding the request
 * to the API worker. It accepts connection configuration and returns the job ID
 * for status tracking.
 *
 * @param req - The incoming Next.js request object
 * @returns Promise that resolves to a Next.js response with job information
 */
export async function POST(req: Request) {
  try {
    // Parse the request body, with fallback to empty object if parsing fails
    const body = await req.json().catch(() => ({}))

    // Determine the API worker URL from environment variables
    const apiUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "https://hubble-api-preview.github-cc7.workers.dev"

    // Forward the connection enable request to the API worker
    const response = await fetch(`${apiUrl}/v1/connect/enable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body), // Forward the connection configuration
    })

    // Handle API worker errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      return NextResponse.json(errorData, { status: response.status })
    }

    // Return the job information from the API worker
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    // Log the error for debugging
    console.error("Connect endpoint error:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
