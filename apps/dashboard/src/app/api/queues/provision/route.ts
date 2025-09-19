import { NextResponse } from "next/server"
import { createApiHandler } from "@hubble/utils/server"
import { processProvisionJob } from "@hubble/utils/connect/provision-job"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return createApiHandler(
    async (_req: Request, auth, reqLogger) => {
      const body = await request.json()
      const { org_id, correlation_id } = body

      reqLogger.info("queues.provision.job_started", {
        orgId: org_id,
        correlationId: correlation_id,
      })

      try {
        // Call the real provisioning job
        await processProvisionJob({
          orgId: org_id,
          correlationId: correlation_id,
        })

        reqLogger.info("queues.provision.job_completed", {
          orgId: org_id,
          correlationId: correlation_id,
        })

        return NextResponse.json({ success: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const errorDetails =
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error

        reqLogger.error("queues.provision.job_failed", {
          error: message,
          errorDetails,
          orgId: org_id,
          correlationId: correlation_id,
        })

        return NextResponse.json(
          { error: "Provisioning job failed", details: errorDetails },
          { status: 500 },
        )
      }
    },
    { requireAuth: false, loggerContext: { endpoint: "/api/queues/provision" } },
  )(request)
}
