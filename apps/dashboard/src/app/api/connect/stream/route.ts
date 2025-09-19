import { NextResponse } from "next/server"
import { createApiHandler, createConnectStatusStream, RunNotFoundError } from "@hubble/utils/server"

export const runtime = "nodejs" // Node runtime + Fluid compute configured in vercel.json

export async function GET(request: Request) {
  return createApiHandler(
    async (req: Request, auth, reqLogger) => {
      const reqId = crypto.randomUUID()
      const url = new URL(req.url)
      const correlationId = url.searchParams.get("correlation_id")?.trim() ?? ""

      // SSE clients must provide the correlation id that /enable returned.
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
        const response = await createConnectStatusStream(auth!.orgId, correlationId, reqLogger)
        return response
      } catch (error) {
        if (error instanceof RunNotFoundError) {
          return NextResponse.json(
            { error: { code: "NOT_FOUND", message: "Run not found" }, request_id: reqId },
            { status: 404 },
          )
        }

        reqLogger.error("connect.stream.bootstrap_failed", {
          error: error instanceof Error ? error.message : String(error),
          errorDetails:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : error,
          correlation_id: correlationId,
        })
        return NextResponse.json(
          {
            error: { code: "INTERNAL_ERROR", message: "Failed to open stream" },
            request_id: reqId,
          },
          { status: 500 },
        )
      }
    },
    { requireAuth: true, requireOrg: true, loggerContext: { endpoint: "/api/connect/stream" } },
  )(request as unknown as Request)
}
