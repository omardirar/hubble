import { NextResponse } from "next/server"
import { createApiHandler } from "@hubble/utils/server"
import { createBrowserClient } from "@hubble/db"

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
        const orgId = auth.orgId
        const supabase = createBrowserClient({ authToken: auth.token })

        // Check organization provisioning status
        const { data: organization, error: organizationError } = await supabase
          .from("core.organizations")
          .select("status, updated_at")
          .eq("org_id", orgId)
          .single()

        if (organizationError) {
          reqLogger.error("connect.status-check.organization_query_failed", {
            error: organizationError.message,
            orgId,
          })
          return NextResponse.json(
            {
              error: { code: "QUERY_FAILED", message: "Failed to check organization status" },
              request_id: reqId,
            },
            { status: 500 },
          )
        }

        if (!organization) {
          reqLogger.error("connect.status-check.organization_not_found", { orgId })
          return NextResponse.json(
            {
              error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" },
              request_id: reqId,
            },
            { status: 404 },
          )
        }

        const status = organization.status as "provisioning" | "ready" | "suspended" | "failed"
        const isProvisioned = status === "ready"
        const lastProvisionedAt = organization.updated_at

        reqLogger.info("connect.status-check.success", {
          orgId,
          status,
          isProvisioned,
          lastProvisionedAt,
        })

        return NextResponse.json({
          status,
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
