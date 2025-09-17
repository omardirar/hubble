import { NextResponse } from "next/server"
import { createApiHandler, getStatus, RunNotFoundError } from "@hubble/utils/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  return createApiHandler(
    async (req: Request, auth, reqLogger) => {
      const reqId = crypto.randomUUID()
      const url = new URL(req.url)
      const correlationId = url.searchParams.get("correlation_id")?.trim() ?? ""

      // Reject early so clients get immediate feedback before hitting Supabase.
      if (!correlationId) {
        return NextResponse.json(
          {
            error: { code: "VALIDATION_ERROR", message: "correlation_id is required" },
            request_id: reqId,
          },
          { status: 400 },
        )
      }

      try {
        // Server utilities enforce org scoping and return schema-safe payloads.
        const result = await getStatus(auth!.orgId, correlationId)
        return NextResponse.json(result)
      } catch (error) {
        if (error instanceof RunNotFoundError) {
          return NextResponse.json(
            { error: { code: "NOT_FOUND", message: "Run not found" }, request_id: reqId },
            { status: 404 },
          )
        }

        // Log unexpected failures to help trace upstream connectivity or parsing issues.
        reqLogger.error("connect.status.failed", {
          error: error instanceof Error ? error.message : String(error),
          correlation_id: correlationId,
        })
        return NextResponse.json(
          {
            error: { code: "INTERNAL_ERROR", message: "Failed to retrieve run status" },
            request_id: reqId,
          },
          { status: 500 },
        )
      }
    },
    { requireAuth: true, requireOrg: true, loggerContext: { endpoint: "/api/connect/status" } },
  )(request as unknown as Request)
}
