import { NextResponse } from "next/server"
import { createApiHandler } from "@hubble/utils/server"
import { insertProvisionRun } from "@hubble/utils/server"
import { enqueueProvisionJob } from "@hubble/utils/server"
import { TenantNotFoundError } from "@hubble/utils/server"
import { EnableResponseSchema } from "@hubble/api-contracts/connect"

export const runtime = "nodejs" // Ensure Node runtime for SDKs

export async function POST(request: Request) {
  return createApiHandler(
    async (_req: Request, auth, reqLogger) => {
      const reqId = crypto.randomUUID()
      if (!auth) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized" }, request_id: reqId },
          { status: 401 },
        )
      }
      // Create run in DB
      let correlation_id: string
      try {
        const run = await insertProvisionRun(auth.orgId)
        correlation_id = run.correlation_id
      } catch (error) {
        if (error instanceof TenantNotFoundError) {
          reqLogger.warn("connect.enable.tenant_missing", { orgId: auth.orgId })
          return NextResponse.json(
            {
              error: {
                code: "TENANT_NOT_FOUND",
                message:
                  "Tenant record not found. Please sync organization metadata before enabling Connect.",
              },
              request_id: reqId,
            },
            { status: 409 },
          )
        }

        reqLogger.error("connect.enable.insert_failed", {
          error: error instanceof Error ? error.message : String(error),
          errorCode:
            error instanceof Error && "code" in error
              ? (error as { code?: string }).code
              : undefined,
          orgId: auth.orgId,
        })
        return NextResponse.json(
          {
            error: { code: "INTERNAL_ERROR", message: "Failed to start provisioning run" },
            request_id: reqId,
          },
          { status: 500 },
        )
      }

      // Enqueue provisioning job via QStash, targeting our own API consumer
      // Derive base URL from request headers (supports Vercel/Next)
      const headers = new Headers(request.headers)
      const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000"
      const protocol = (headers.get("x-forwarded-proto") ??
        (host.startsWith("localhost") ? "http" : "https")) as "http" | "https"
      const baseUrl = `${protocol}://${host}`
      try {
        await enqueueProvisionJob(baseUrl, { org_id: auth.orgId, correlation_id })
      } catch (e) {
        reqLogger.error("qstash.enqueue.failed", { error: String(e) })
        return NextResponse.json(
          {
            error: { code: "ENQUEUE_FAILED", message: "Failed to enqueue provisioning" },
            request_id: reqId,
          },
          { status: 502 },
        )
      }

      const body = { correlation_id, status: "pending" as const, request_id: reqId }
      // Validate response contract
      EnableResponseSchema.parse(body)
      return NextResponse.json(body)
    },
    { requireAuth: true, requireOrg: true, loggerContext: { endpoint: "/api/connect/enable" } },
  )(request as unknown as Request)
}
