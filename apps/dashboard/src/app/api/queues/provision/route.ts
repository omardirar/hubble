import { NextResponse } from "next/server"
import { createApiHandler, withQStashVerification } from "@hubble/utils/server"
import { processProvisionJob } from "@hubble/utils/connect/provision-job"
import { validateProvisionJobPayload } from "@hubble/api-contracts/connect"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return withQStashVerification(
    async (req: Request) => {
      return createApiHandler(
        async (_req: Request, auth, reqLogger) => {
          const reqId = crypto.randomUUID()

          let body: unknown
          try {
            const text = await req.text()
            body = text ? JSON.parse(text) : {}
          } catch (error) {
            reqLogger.error("queues.provision.invalid_json", {
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

          let validatedPayload
          try {
            validatedPayload = validateProvisionJobPayload(body)
          } catch (error) {
            reqLogger.error("queues.provision.validation_failed", {
              error: error instanceof Error ? error.message : String(error),
              body,
            })
            return NextResponse.json(
              {
                error: { code: "VALIDATION_ERROR", message: "Invalid request payload" },
                request_id: reqId,
              },
              { status: 400 },
            )
          }

          const { org_id, correlation_id } = validatedPayload

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
                : { error: String(error) }

            // Ensure error details are properly serialized
            const serializedErrorDetails = JSON.parse(JSON.stringify(errorDetails))

            reqLogger.error("queues.provision.job_failed", {
              error: message,
              error_details: serializedErrorDetails,
              orgId: org_id,
              correlationId: correlation_id,
            })

            return NextResponse.json(
              {
                error: {
                  code: "PROVISIONING_FAILED",
                  message: "Provisioning job failed",
                  details: errorDetails,
                },
                request_id: reqId,
              },
              { status: 500 },
            )
          }
        },
        { requireAuth: false, loggerContext: { endpoint: "/api/queues/provision" } },
      )(req)
    },
    { skipVerification: false },
  )(request)
}
