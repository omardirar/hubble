import { NextRequest, NextResponse } from "next/server"
import { logger } from "@hubble/logger"

// This route uses DuckDB Node.js client and should not be bundled
// It runs in a separate serverless function with native dependencies
// This is an internal API route, so we use a simple API key for security

// export const runtime = "nodejs" // Ensure NOT edge runtime

export async function POST(request: NextRequest) {
  logger.info("motherduck.create_database.api.request_received", {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  })

  // Simple API key authentication for internal use
  const apiKey = request.headers.get("x-api-key")
  const expectedApiKey = process.env.INTERNAL_API_KEY || "internal-db-creation-key"

  logger.info("motherduck.create_database.api.auth_check", {
    providedKey: apiKey ? "***" : "none",
    expectedKey: expectedApiKey ? "***" : "none",
    hasApiKey: !!apiKey,
    hasExpectedKey: !!expectedApiKey,
    keysMatch: apiKey === expectedApiKey,
  })

  if (apiKey !== expectedApiKey) {
    logger.warn("motherduck.create_database.api.unauthorized", {
      providedKey: apiKey ? "***" : "none",
      expectedKey: expectedApiKey ? "***" : "none",
    })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { dbName, token } = await request.json()

    // Basic validation
    if (!dbName || typeof dbName !== "string") {
      return NextResponse.json({ error: "Database name is required" }, { status: 400 })
    }

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    logger.info("motherduck.create_database.api.started", {
      dbName,
    })

    // For now, just simulate successful database creation
    // This will help us test if the route is working
    logger.info("motherduck.create_database.api.simulated_success", {
      dbName,
      message: "Database creation simulated successfully",
    })

    return NextResponse.json({
      success: true,
      database: dbName,
      message: "Database created successfully (simulated)",
    })
  } catch (error) {
    logger.error("motherduck.create_database.api.failed", {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
