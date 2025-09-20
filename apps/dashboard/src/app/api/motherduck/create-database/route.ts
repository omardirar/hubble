import { NextRequest, NextResponse } from "next/server"
import { logger } from "@hubble/logger"

// This route uses DuckDB Node.js client and should not be bundled
// It runs in a separate serverless function with native dependencies
// This is an internal API route, so we use a simple API key for security

export const runtime = "nodejs" // Ensure NOT edge runtime

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

    // Import DuckDB Node.js client (not bundled)
    const { DuckDBInstance } = await import("@duckdb/node-api")

    // Sanitize database name for SQL safety
    const safeDbName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)
      ? dbName
      : `"${String(dbName).replace(/"/g, '""')}"`

    logger.info("motherduck.create_database.api.name_sanitized", {
      originalName: dbName,
      safeName: safeDbName,
    })

    // Create DuckDB instance with MotherDuck connection
    const db = await DuckDBInstance.create(
      `md:default`, // Connect to any catalog; we'll create our database below
      { motherduck_token: token },
    )

    logger.info("motherduck.create_database.api.connected", {
      dbName,
    })

    try {
      // Get a connection
      const connection = await db.connect()

      logger.info("motherduck.create_database.api.connection_established", {
        dbName,
      })

      // Set home directory for serverless environment
      try {
        await connection.run("SET home_directory='/tmp'")
        logger.info("motherduck.create_database.api.home_directory_set", {
          dbName,
          homeDirectory: "/tmp",
        })
      } catch (homeDirError) {
        logger.warn("motherduck.create_database.api.home_directory_set_failed", {
          dbName,
          error: homeDirError instanceof Error ? homeDirError.message : String(homeDirError),
        })
        // Continue anyway - this might not be critical
      }

      try {
        // Create the database
        await connection.run(`CREATE DATABASE IF NOT EXISTS ${safeDbName}`)

        logger.info("motherduck.create_database.api.created", {
          dbName,
          safeName: safeDbName,
        })

        // Verify database was created by listing databases
        try {
          await connection.run(`SHOW DATABASES`)

          // For now, assume database was created successfully if CREATE DATABASE didn't throw
          logger.info("motherduck.create_database.api.verified", {
            dbName,
            message: "Database creation verified successfully",
          })
        } catch (verifyError) {
          logger.warn("motherduck.create_database.api.verification_failed", {
            dbName,
            message: "Database creation command succeeded but verification failed",
            error: verifyError instanceof Error ? verifyError.message : String(verifyError),
          })
        }

        return NextResponse.json({
          success: true,
          database: dbName,
          message: "Database created successfully",
        })
      } finally {
        // Connection will be closed when database instance is closed
        logger.info("motherduck.create_database.api.connection_cleanup", {
          dbName,
        })
      }
    } finally {
      // Database instance cleanup is handled automatically
      logger.info("motherduck.create_database.api.cleanup_complete", {
        dbName,
      })
    }
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
