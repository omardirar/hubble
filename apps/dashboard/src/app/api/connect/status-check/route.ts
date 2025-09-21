import { NextResponse } from "next/server"
import { createApiHandler } from "@hubble/utils/server"
import { createBrowserClient } from "@hubble/db"
import { getCurrentOrgId } from "@hubble/auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  return createApiHandler(
    async (_req: Request, auth, reqLogger) => {
      const reqId = crypto.randomUUID()

      if (!auth) {
        reqLogger.error("connect.status-check.unauthorized", {})
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized" }, request_id: reqId },
          { status: 401 },
        )
      }

      if (!auth.orgId) {
        reqLogger.error("connect.status-check.no_org", { userId: auth.userId })
        return NextResponse.json(
          {
            error: { code: "NO_ORGANIZATION", message: "No organization found" },
            request_id: reqId,
          },
          { status: 400 },
        )
      }

      try {
        const orgId = await getCurrentOrgId()
        if (!orgId) {
          reqLogger.error("connect.status-check.no_org_id", { userId: auth.userId })
          return NextResponse.json(
            {
              error: { code: "NO_ORGANIZATION", message: "No organization found" },
              request_id: reqId,
            },
            { status: 400 },
          )
        }

        const supabase = createBrowserClient({ authToken: auth.token })

        // Check if there's a tenant destination (indicator of completed provisioning)
        const { data: destinations, error: destError } = await supabase
          .from("tenant_destinations")
          .select("status, created_at")
          .eq("org_id", orgId)
          .eq("status", "healthy")
          .order("created_at", { ascending: false })
          .limit(1)

        if (destError) {
          reqLogger.error("connect.status-check.destinations_query_failed", {
            error: destError.message,
            orgId,
          })
          return NextResponse.json(
            {
              error: { code: "QUERY_FAILED", message: "Failed to check destination status" },
              request_id: reqId,
            },
            { status: 500 },
          )
        }

        const isProvisioned = destinations && destinations.length > 0
        const lastProvisionedAt = destinations?.[0]?.created_at

        reqLogger.info("connect.status-check.success", {
          orgId,
          isProvisioned,
          hasDestination: destinations && destinations.length > 0,
          lastProvisionedAt,
        })

        return NextResponse.json({
          isProvisioned,
          lastProvisionedAt,
          request_id: reqId,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        reqLogger.error("connect.status-check.failed", {
          error: errorMessage,
          orgId: auth.orgId,
        })
        return NextResponse.json(
          {
            error: { code: "INTERNAL_ERROR", message: "Failed to check provisioning status" },
            request_id: reqId,
          },
          { status: 500 },
        )
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/connect/status-check" },
    },
  )(request)
}
