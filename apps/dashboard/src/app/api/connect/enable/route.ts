import { NextResponse } from "next/server"
import { createApiHandler } from "@hubble/utils/server"
import { insertProvisionRun } from "@hubble/utils/server"
import { enqueueProvisionJob } from "@hubble/utils/server"
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
      const { correlation_id } = await insertProvisionRun(auth.orgId)

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
