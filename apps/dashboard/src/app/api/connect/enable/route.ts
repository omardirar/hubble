/**
 * Connect Enable API Route
 *
 * Enables data connection provisioning for an organization by creating
 * a provisioning run and enqueueing it via QStash for background processing.
 *
 * Flow:
 * 1. Validate request and authentication
 * 2. Create provisioning run in database
 * 3. Enqueue background job via QStash
 * 4. Return correlation ID for status tracking
 *
 * @param request - HTTP request containing enable request data
 * @returns JSON response with correlation ID and status
 */

import { NextResponse } from "next/server"
import {
  createApiHandler,
  insertProvisionRun,
  updateProvisionRun,
  dispatchJson,
  QStashPublishError,
  TenantNotFoundError,
} from "@hubble/server"
import { EnableResponseSchema, validateEnableRequest } from "@hubble/schemas/connect"
import { connectLogger } from "@hubble/logger"
import { generateRequestId, buildApiUrl } from "@hubble/core"

// Ensure Node.js runtime for SDK compatibility
export const runtime = "nodejs"

export async function POST(request: Request) {
  return createApiHandler(
    async (_req: Request, auth, _reqLogger) => {
      const reqId = generateRequestId()

      // Step 1: Parse and validate request body
      let requestBody: unknown
      try {
        const text = await request.text()
        requestBody = text ? JSON.parse(text) : {}
      } catch (error) {
        connectLogger.stepFailed(reqId, "json_parsing", error as Error, {
          orgId: auth?.orgId,
        })
        return NextResponse.json(
          {
            error: { code: "INVALID_JSON", message: "Invalid JSON in request body" },
            request_id: reqId,
          },
          { status: 400 },
        )
      }

      // Validate request schema
      try {
        validateEnableRequest(requestBody)
      } catch (error) {
        connectLogger.stepFailed(reqId, "validation", error as Error, {
          orgId: auth?.orgId,
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

      // Step 2: Verify authentication and organization context
      if (!auth) {
        connectLogger.stepFailed(reqId, "authentication", new Error("No authentication provided"), {
          requestId: reqId,
        })
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized" }, request_id: reqId },
          { status: 401 },
        )
      }

      if (!auth.orgId) {
        connectLogger.stepFailed(
          reqId,
          "organization_validation",
          new Error("No organization found"),
          {
            userId: auth.userId,
            requestId: reqId,
          },
        )
        return NextResponse.json(
          {
            error: { code: "NO_ORGANIZATION", message: "No organization found" },
            request_id: reqId,
          },
          { status: 400 },
        )
      }

      // Step 3: Create provisioning run in database
      let correlation_id: string
      try {
        const run = await insertProvisionRun(auth.orgId)
        correlation_id = run.correlation_id
        connectLogger.stepComplete(reqId, "run_creation", 0, {
          orgId: auth.orgId,
          correlationId: correlation_id,
        })
      } catch (error) {
        if (error instanceof TenantNotFoundError) {
          connectLogger.stepFailed(reqId, "tenant_validation", error, {
            orgId: auth.orgId,
            errorCode: "TENANT_NOT_FOUND",
          })
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

        connectLogger.stepFailed(reqId, "run_creation", error as Error, {
          orgId: auth.orgId,
          errorCode: (error as Error & { code?: string }).code,
        })
        return NextResponse.json(
          {
            error: { code: "INTERNAL_ERROR", message: "Failed to start provisioning run" },
            request_id: reqId,
          },
          { status: 500 },
        )
      }

      // Step 4: Enqueue provisioning job via QStash
      const targetUrl = buildApiUrl(request.headers, "/api/queues/provision")

      try {
        connectLogger.stepProgress(correlation_id, "qstash_enqueue", "starting", {
          targetUrl,
          orgId: auth.orgId,
        })

        // Dispatch job to QStash with deduplication key
        await dispatchJson({
          targetUrl,
          body: { org_id: auth.orgId, correlation_id },
          dedupeKey: correlation_id,
        })

        connectLogger.stepComplete(correlation_id, "qstash_enqueue", 0, {
          orgId: auth.orgId,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        connectLogger.stepFailed(correlation_id, "qstash_enqueue", error as Error, {
          orgId: auth.orgId,
        })

        // Clean up the failed provisioning run to maintain data consistency
        try {
          await updateProvisionRun(correlation_id, {
            status: "failed",
            finished_at: new Date().toISOString(),
            error_message: message,
          })
          connectLogger.stepComplete(correlation_id, "cleanup", 0, {
            orgId: auth.orgId,
          })
        } catch (cleanupError) {
          connectLogger.stepFailed(correlation_id, "cleanup", cleanupError as Error, {
            orgId: auth.orgId,
          })
        }

        // Handle specific QStash errors with user-friendly messages
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

        // Generic enqueue failure
        return NextResponse.json(
          {
            error: { code: "ENQUEUE_FAILED", message: "Failed to enqueue provisioning" },
            request_id: reqId,
          },
          { status: 502 },
        )
      }

      // Step 5: Return success response with correlation ID
      connectLogger.provisionStart(correlation_id, auth.orgId, {
        requestId: reqId,
        status: "pending",
      })

      const body = { correlation_id, status: "pending" as const, request_id: reqId }
      EnableResponseSchema.parse(body)
      return NextResponse.json(body)
    },
    { requireAuth: true, requireOrg: true, loggerContext: { endpoint: "/api/connect/enable" } },
  )(request)
}
