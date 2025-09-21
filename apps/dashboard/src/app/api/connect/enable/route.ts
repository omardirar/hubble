import { NextResponse } from "next/server"
import {
  createApiHandler,
  insertProvisionRun,
  updateProvisionRun,
  dispatchQStashJson,
  QStashPublishError,
  TenantNotFoundError,
} from "@hubble/utils/server"
import { EnableResponseSchema, validateEnableRequest } from "@hubble/api-contracts/connect"

export const runtime = "nodejs" // Ensure Node runtime for SDKs

export async function POST(request: Request) {
  return createApiHandler(
    async (_req: Request, auth, reqLogger) => {
      const reqId = crypto.randomUUID()

      // Validate request body
      let requestBody: unknown
      try {
        const text = await request.text()
        requestBody = text ? JSON.parse(text) : {}
      } catch (error) {
        reqLogger.error("connect.enable.invalid_json", {
          error: error instanceof Error ? error.message : String(error),
        })
        return NextResponse.json(
          {
            error: { code: "INVALID_JSON", message: "Invalid JSON in request body" },
            request_id: reqId,
          },
          { status: 400 },
        )
      }

      try {
        validateEnableRequest(requestBody)
      } catch (error) {
        reqLogger.error("connect.enable.validation_failed", {
          error: error instanceof Error ? error.message : String(error),
          body: requestBody,
        })
        return NextResponse.json(
          {
            error: { code: "VALIDATION_ERROR", message: "Invalid request payload" },
            request_id: reqId,
          },
          { status: 400 },
        )
      }

      if (!auth) {
        reqLogger.error("connect.enable.unauthorized", {})
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized" }, request_id: reqId },
          { status: 401 },
        )
      }

      if (!auth.orgId) {
        reqLogger.error("connect.enable.no_org", { userId: auth.userId })
        return NextResponse.json(
          {
            error: { code: "NO_ORGANIZATION", message: "No organization found" },
            request_id: reqId,
          },
          { status: 400 },
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

      // Enqueue provisioning job via QStash
      const headers = new Headers(request.headers)
      const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000"
      const protocol = (headers.get("x-forwarded-proto") ??
        (host.startsWith("localhost") ? "http" : "https")) as "http" | "https"
      const baseUrl = `${protocol}://${host}`
      const targetUrl = new URL("/api/queues/provision", baseUrl).toString()

      try {
        reqLogger.info("connect.enable.enqueuing_job", {
          targetUrl,
          orgId: auth.orgId,
          correlationId: correlation_id,
        })

        await dispatchQStashJson({
          targetUrl,
          body: { org_id: auth.orgId, correlation_id },
          dedupeKey: correlation_id,
        })

        reqLogger.info("connect.enable.job_enqueued", {
          orgId: auth.orgId,
          correlationId: correlation_id,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        reqLogger.error("qstash.enqueue.failed", {
          error: message,
          orgId: auth.orgId,
          correlationId: correlation_id,
        })

        // Clean up the failed provisioning run
        try {
          await updateProvisionRun(correlation_id, {
            status: "failed",
            finished_at: new Date().toISOString(),
            error_message: message,
          })
          reqLogger.info("connect.enable.cleanup_completed", {
            orgId: auth.orgId,
            correlationId: correlation_id,
          })
        } catch (cleanupError) {
          reqLogger.error("connect.enable.cleanup_failed", {
            orgId: auth.orgId,
            correlationId: correlation_id,
            cleanupError:
              cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          })
        }

        if (error instanceof QStashPublishError) {
          // Check if it's a development server token error
          if (message.includes("development server token")) {
            return NextResponse.json(
              {
                error: {
                  code: "QSTASH_CONFIG_ERROR",
                  message:
                    "Invalid QStash configuration. Please check your QSTASH_TOKEN and QSTASH_URL in .env.local. You may be using a development server token with production QStash.",
                },
                request_id: reqId,
              },
              { status: 502 },
            )
          }

          return NextResponse.json(
            {
              error: { code: "ENQUEUE_FAILED", message: "Failed to enqueue provisioning" },
              request_id: reqId,
            },
            { status: 502 },
          )
        }
        return NextResponse.json(
          {
            error: { code: "ENQUEUE_FAILED", message: "Failed to enqueue provisioning" },
            request_id: reqId,
          },
          { status: 502 },
        )
      }

      const body = { correlation_id, status: "pending" as const, request_id: reqId }
      EnableResponseSchema.parse(body)

      // Check if this is a browser request (has Accept header with text/html)
      const acceptHeader = request.headers.get("accept") || ""
      const isBrowserRequest = acceptHeader.includes("text/html")

      if (isBrowserRequest) {
        // PRG pattern: redirect to /connect with correlation_id
        const headers = new Headers(request.headers)
        const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000"
        const protocol = (headers.get("x-forwarded-proto") ??
          (host.startsWith("localhost") ? "http" : "https")) as "http" | "https"
        const baseUrl = `${protocol}://${host}`
        const redirectUrl = new URL("/connect", baseUrl)
        redirectUrl.searchParams.set("correlation_id", correlation_id)

        reqLogger.info("connect.enable.prg_redirect", {
          orgId: auth.orgId,
          correlationId: correlation_id,
          redirectUrl: redirectUrl.toString(),
        })

        return NextResponse.redirect(redirectUrl.toString(), { status: 303 })
      }

      // For non-browser requests (API clients), return JSON
      return NextResponse.json(body)
    },
    { requireAuth: true, requireOrg: true, loggerContext: { endpoint: "/api/connect/enable" } },
  )(request)
}
