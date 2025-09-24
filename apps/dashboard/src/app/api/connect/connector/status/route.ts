/**
 * Fivetran Connector Status API Route
 *
 * Retrieves the status of a Fivetran connector and updates the local database.
 * This endpoint provides real-time connector status information.
 *
 * Flow:
 * 1. Validate request and authentication
 * 2. Get connector from Fivetran API
 * 3. Update local database with latest status
 * 4. Return connector status
 *
 * @param request - HTTP request with connector_id query parameter
 * @returns JSON response with connector status
 */

import { NextResponse } from "next/server"
import {
  createApiHandler,
  getDataConnections,
  updateDataConnection,
  fivetranGetConnector,
} from "@hubble/server"
import { generateRequestId } from "@hubble/core"

// Ensure Node.js runtime for SDK compatibility
export const runtime = "nodejs"

export async function GET(request: Request) {
  return createApiHandler(
    async (req: Request, auth, reqLogger) => {
      const reqId = generateRequestId()
      const url = new URL(req.url)
      const connectorId = url.searchParams.get("connector_id")?.trim()

      // Validate connector_id parameter
      if (!connectorId) {
        reqLogger.error("connect.connector.status.validation_failed", {
          error: "connector_id is required",
          orgId: auth?.orgId,
          requestId: reqId,
        })
        return NextResponse.json(
          {
            error: { code: "VALIDATION_ERROR", message: "connector_id is required" },
            request_id: reqId,
          },
          { status: 400 },
        )
      }

      // Step 1: Verify authentication and organization context
      if (!auth) {
        reqLogger.error("connect.connector.status.authentication_failed", {
          error: "No authentication provided",
          requestId: reqId,
        })
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized" }, request_id: reqId },
          { status: 401 },
        )
      }

      if (!auth.orgId) {
        reqLogger.error("connect.connector.status.org_context_failed", {
          error: "No organization context",
          requestId: reqId,
        })
        return NextResponse.json(
          {
            error: { code: "FORBIDDEN", message: "Organization context required" },
            request_id: reqId,
          },
          { status: 403 },
        )
      }

      try {
        // Step 2: Get connector from Fivetran API
        reqLogger.info("connect.connector.status.getting_connector", {
          connectorId,
          orgId: auth.orgId,
          requestId: reqId,
        })

        const fivetranConnector = await fivetranGetConnector(connectorId)

        if (!fivetranConnector) {
          reqLogger.error("connect.connector.status.connector_not_found", {
            error: "Connector not found",
            connectorId,
            orgId: auth.orgId,
            requestId: reqId,
          })
          return NextResponse.json(
            {
              error: { code: "CONNECTOR_NOT_FOUND", message: "Connector not found" },
              request_id: reqId,
            },
            { status: 404 },
          )
        }

        reqLogger.info("connect.connector.status.connector_retrieved", {
          connectorId,
          status: fivetranConnector.status,
          requestId: reqId,
        })

        // Step 3: Find and update local database record
        const connections = await getDataConnections(auth.orgId, auth.token)
        const localConnection = connections.find(
          (conn) => conn.fivetran_connector_id === connectorId,
        )

        if (localConnection) {
          // Map Fivetran status to our internal status
          let internalStatus = "needs_auth"
          if (fivetranConnector.status === "connected") {
            internalStatus = "healthy"
          } else if (fivetranConnector.status === "error") {
            internalStatus = "error"
          } else if (fivetranConnector.status === "paused") {
            internalStatus = "paused"
          } else if (fivetranConnector.status === "syncing") {
            internalStatus = "syncing"
          }

          await updateDataConnection(localConnection.id, {
            status: internalStatus,
            schema_name: fivetranConnector.schema,
          })

          reqLogger.info("connect.connector.status.local_connection_updated", {
            connectionId: localConnection.id,
            internalStatus,
            requestId: reqId,
          })
        } else {
          reqLogger.info("connect.connector.status.no_local_connection", {
            message: "No local connection found for connector",
            connectorId,
            requestId: reqId,
          })
        }

        // Step 4: Return connector status
        const response = {
          connector_id: fivetranConnector.id,
          service: fivetranConnector.service,
          schema: fivetranConnector.schema,
          status: fivetranConnector.status,
          connected_by: fivetranConnector.connected_by,
          created_at: fivetranConnector.created_at,
          succeeded_at: fivetranConnector.succeeded_at,
          failed_at: fivetranConnector.failed_at,
          request_id: reqId,
        }

        reqLogger.info("connect.connector.status.completed", {
          connectorId,
          status: fivetranConnector.status,
          requestId: reqId,
        })

        return NextResponse.json(response, { status: 200 })
      } catch (error) {
        const errorDetails =
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error

        reqLogger.error("connect.connector.status.failed", {
          error: error instanceof Error ? error.message : String(error),
          connectorId,
          orgId: auth.orgId,
          errorDetails,
          requestId: reqId,
        })

        return NextResponse.json(
          {
            error: {
              code: "CONNECTOR_STATUS_FAILED",
              message: "Failed to get connector status",
              details: errorDetails,
            },
            request_id: reqId,
          },
          { status: 500 },
        )
      }
    },
    { requireAuth: true, requireOrg: true },
  )(request)
}
