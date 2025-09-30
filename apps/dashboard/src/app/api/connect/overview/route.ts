/**
 * Connect Overview API Route
 *
 * Provides a comprehensive overview of an organization's Connect status in a single request.
 * This endpoint combines organization status, data connections, and available connector types
 * to minimize round-trips and improve performance.
 *
 * Performance optimizations:
 * - Single request replaces 3 separate API calls
 * - Uses optimized v_organization_overview view
 * - Parallel fetching with Promise.all
 * - Response caching headers
 *
 * @returns JSON with organization status, connections, and available connectors
 */

import { NextResponse } from "next/server"
import { createApiHandler } from "@hubble/server"
import { createBrowserClient } from "@hubble/db"
import { generateRequestId } from "@hubble/core"
import { getFivetranConnectionOverview } from "@hubble/connect"

export const runtime = "nodejs"

// Cache connector types for 1 hour since they rarely change
export const revalidate = 3600

export async function GET(request: Request) {
  return createApiHandler(
    async (_req: Request, auth, reqLogger) => {
      const reqId = generateRequestId()

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
        const supabase = createBrowserClient({ authToken: auth.token })

        reqLogger.info("connect.overview.fetch_started", {
          orgId: auth.orgId,
          requestId: reqId,
        })

        // Fetch all data in parallel for maximum performance
        const [overviewResult, connectionsResult, connectorsResult, fivetranHealthResult] =
          await Promise.all([
            // Use optimized view for org status and connection summary
            supabase.from("v_organization_overview").select("*").eq("org_id", auth.orgId).single(),

            // Get detailed connection data
            supabase
              .from("data_connections")
              .select("*")
              .eq("org_id", auth.orgId)
              .order("created_at", { ascending: false }),

            // Get available connector types (cached at edge)
            supabase.from("connector_types").select("*").order("label"),

            // Get Fivetran health data (gracefully handle if log tables don't exist)
            getFivetranConnectionOverview(auth.token).catch((err) => {
              reqLogger.warn("connect.overview.fivetran_health_unavailable", {
                error: err.message,
                orgId: auth.orgId,
              })
              return []
            }),
          ])

        // Handle errors from any of the queries
        if (overviewResult.error) {
          // Organization not found is not an error - it means not provisioned yet
          if (overviewResult.error.code === "PGRST116") {
            reqLogger.info("connect.overview.organization_not_found", {
              orgId: auth.orgId,
              requestId: reqId,
            })

            return NextResponse.json({
              status: null,
              isProvisioned: false,
              hasConnections: false,
              totalConnections: 0,
              healthyConnections: 0,
              errorConnections: 0,
              connections: [],
              connectors: connectorsResult.data || [],
              request_id: reqId,
            })
          }

          reqLogger.error("connect.overview.query_failed", {
            error: overviewResult.error.message,
            orgId: auth.orgId,
            requestId: reqId,
          })

          return NextResponse.json(
            {
              error: { code: "QUERY_FAILED", message: "Failed to fetch organization overview" },
              request_id: reqId,
            },
            { status: 500 },
          )
        }

        if (connectionsResult.error) {
          reqLogger.error("connect.overview.connections_query_failed", {
            error: connectionsResult.error.message,
            orgId: auth.orgId,
            requestId: reqId,
          })

          return NextResponse.json(
            {
              error: { code: "QUERY_FAILED", message: "Failed to fetch connections" },
              request_id: reqId,
            },
            { status: 500 },
          )
        }

        if (connectorsResult.error) {
          reqLogger.error("connect.overview.connectors_query_failed", {
            error: connectorsResult.error.message,
            requestId: reqId,
          })

          return NextResponse.json(
            {
              error: { code: "QUERY_FAILED", message: "Failed to fetch connector types" },
              request_id: reqId,
            },
            { status: 500 },
          )
        }

        const overview = overviewResult.data
        const connections = connectionsResult.data || []
        const connectors = connectorsResult.data || []
        const fivetranHealth = fivetranHealthResult || []

        const status = overview.org_status as "provisioning" | "ready" | "suspended" | "failed"
        const isProvisioned = status === "ready"

        // Create a map of Fivetran health data by connection ID for easy lookup
        const healthMap = new Map(fivetranHealth.map((h) => [h.local_connection_id, h]))

        // Enrich connections with Fivetran health data
        const enrichedConnections = connections.map((conn) => {
          const health = healthMap.get(conn.id)
          return {
            ...conn,
            // Add Fivetran health data if available (simplified structure)
            fivetran_health: health || null,
          }
        })

        reqLogger.info("connect.overview.fetch_completed", {
          orgId: auth.orgId,
          status,
          isProvisioned,
          connectionCount: connections.length,
          connectorCount: connectors.length,
          fivetranHealthCount: fivetranHealth.length,
          requestId: reqId,
        })

        // Return comprehensive overview
        return NextResponse.json(
          {
            // Organization status
            status,
            isProvisioned,
            lastProvisionedAt: overview.org_updated_at,

            // Destination info
            destinationId: overview.destination_id,
            destinationStatus: overview.destination_status,
            fivetranDestinationId: overview.fivetran_destination_id,
            mdDbName: overview.md_db_name,

            // Connection summary
            hasConnections: connections.length > 0,
            totalConnections: overview.total_connections || 0,
            healthyConnections: overview.healthy_connections || 0,
            errorConnections: overview.error_connections || 0,

            // Detailed data (enriched with Fivetran health)
            connections: enrichedConnections,
            connectors,

            request_id: reqId,
          },
          {
            headers: {
              // Cache for 30 seconds on the client
              "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
            },
          },
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        reqLogger.error("connect.overview.failed", {
          error: errorMessage,
          orgId: auth.orgId,
          requestId: reqId,
        })

        return NextResponse.json(
          {
            error: { code: "INTERNAL_ERROR", message: "Failed to fetch connect overview" },
            request_id: reqId,
          },
          { status: 500 },
        )
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/connect/overview" },
    },
  )(request)
}
