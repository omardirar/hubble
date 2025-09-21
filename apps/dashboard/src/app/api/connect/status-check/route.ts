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

        // Check tenant provisioning status
        const { data: tenant, error: tenantError } = await supabase
          .from("tenant_provisioning")
          .select("status, updated_at, metadata")
          .eq("org_id", orgId)
          .single()

        if (tenantError) {
          reqLogger.error("connect.status-check.tenant_query_failed", {
            error: tenantError.message,
            orgId,
          })
          return NextResponse.json(
            {
              error: { code: "QUERY_FAILED", message: "Failed to check tenant status" },
              request_id: reqId,
            },
            { status: 500 },
          )
        }

        if (!tenant) {
          reqLogger.error("connect.status-check.tenant_not_found", { orgId })
          return NextResponse.json(
            {
              error: { code: "TENANT_NOT_FOUND", message: "Tenant not found" },
              request_id: reqId,
            },
            { status: 404 },
          )
        }

        const status = tenant.status as "running" | "ready" | "failed"
        const isProvisioned = status === "ready"
        const lastProvisionedAt = tenant.updated_at
        const errorMessage = tenant.metadata?.error_message

        reqLogger.info("connect.status-check.success", {
          orgId,
          status,
          isProvisioned,
          lastProvisionedAt,
          hasError: !!errorMessage,
        })

        return NextResponse.json({
          status,
          isProvisioned,
          lastProvisionedAt,
          errorMessage,
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
