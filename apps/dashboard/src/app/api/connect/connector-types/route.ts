/**
 * Get Connector Types API Route
 *
 * Returns all available connector types for the connect page.
 */

import { NextResponse } from "next/server"
import { createApiHandler, getConnectorTypes } from "@hubble/server"

// Ensure Node.js runtime for SDK compatibility
export const runtime = "nodejs"

// Cache connector types for 1 hour since they rarely change
export const revalidate = 3600

export async function GET(request: Request) {
  return createApiHandler(
    async (req: Request, auth, reqLogger) => {
      try {
        const connectorTypes = await getConnectorTypes()

        reqLogger.info("connect.connector_types.fetched", {
          count: connectorTypes.length,
        })

        return NextResponse.json(
          {
            connector_types: connectorTypes,
          },
          {
            headers: {
              // Cache for 1 hour on the client, serve stale for 24 hours
              "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            },
          },
        )
      } catch (error) {
        reqLogger.error("connect.connector_types.fetch_failed", {
          error: error instanceof Error ? error.message : String(error),
        })

        return NextResponse.json(
          {
            error: {
              code: "FETCH_FAILED",
              message: "Failed to fetch connector types",
            },
          },
          { status: 500 },
        )
      }
    },
    { requireAuth: false }, // This endpoint doesn't require auth since it's just listing available types
  )(request)
}
