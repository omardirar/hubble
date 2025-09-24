/**
 * Get Data Connections API Route
 *
 * Returns the list of data connections for the current organization.
 */

import { NextResponse } from "next/server"
import { createApiHandler, getDataConnections } from "@hubble/server"

// Ensure Node.js runtime for SDK compatibility
export const runtime = "nodejs"

export async function GET(request: Request) {
  return createApiHandler(
    async (_req, auth, reqLogger) => {
      if (!auth) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
          { status: 401 },
        )
      }

      if (!auth.orgId) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Organization context required" } },
          { status: 403 },
        )
      }

      try {
        reqLogger.info("connect.connections.get.started", {
          orgId: auth.orgId,
        })

        const connections = await getDataConnections(auth.orgId, auth.token)

        reqLogger.info("connect.connections.get.completed", {
          orgId: auth.orgId,
          count: connections.length,
        })

        return NextResponse.json({
          connections,
        })
      } catch (error) {
        reqLogger.error("connect.connections.get.failed", {
          error: error instanceof Error ? error.message : String(error),
          orgId: auth.orgId,
        })

        return NextResponse.json(
          {
            error: {
              code: "CONNECTIONS_FETCH_FAILED",
              message: "Failed to fetch data connections",
            },
          },
          { status: 500 },
        )
      }
    },
    { requireAuth: true, requireOrg: true },
  )(request)
}
