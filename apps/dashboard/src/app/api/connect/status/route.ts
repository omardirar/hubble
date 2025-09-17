import { NextResponse } from "next/server"
import { createApiHandler } from "@hubble/utils/server"
import { getStatus } from "@hubble/utils/server"
import { StatusResponseSchema } from "@hubble/api-contracts/connect"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const correlation_id = url.searchParams.get("correlation_id") || ""
  return createApiHandler(
    async (_req: Request, auth, reqLogger) => {
      const reqId = crypto.randomUUID()
      if (!auth) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized" }, request_id: reqId },
          { status: 401 },
        )
      }
      if (!correlation_id) {
        return NextResponse.json(
          {
            error: { code: "VALIDATION_ERROR", message: "correlation_id is required" },
            request_id: reqId,
          },
          { status: 400 },
        )
      }
      try {
        const result = await getStatus(auth.orgId, correlation_id)
        StatusResponseSchema.parse(result)
        return NextResponse.json(result)
      } catch (e) {
        reqLogger.error("status.failed", { error: String(e), correlation_id })
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Run not found" }, request_id: reqId },
          { status: 404 },
        )
      }
    },
    { requireAuth: true, requireOrg: true, loggerContext: { endpoint: "/api/connect/status" } },
  )(request as unknown as Request)
}
