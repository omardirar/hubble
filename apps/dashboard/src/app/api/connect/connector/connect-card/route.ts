/**
 * Get Fivetran Connect Card URL API Route
 *
 * Generates a Connect Card URL for editing an existing Fivetran connector.
 * This endpoint retrieves a one-time URL that users can use to configure
 * their connector settings through Fivetran's hosted UI.
 *
 * Flow:
 * 1. Validate request and authentication
 * 2. Get connector details from database
 * 3. Call Fivetran API to generate Connect Card URL
 * 4. Return Connect Card URL for frontend to redirect
 *
 * @param request - HTTP request containing connection_id
 * @returns JSON response with Connect Card URL
 */

import { NextResponse } from "next/server"
import { createApiHandler } from "@hubble/server"
import { fivetranGetConnectCardUrl } from "@hubble/connect"
import { createBrowserClient } from "@hubble/db"
import { generateRequestId } from "@hubble/core"
import { z } from "zod"

// Ensure Node.js runtime for SDK compatibility
export const runtime = "nodejs"

// Request validation schema
const ConnectCardRequestSchema = z.object({
  connection_id: z.string().min(1, "Connection ID is required"),
})

type ConnectCardRequest = z.infer<typeof ConnectCardRequestSchema>

export async function POST(request: Request) {
  return createApiHandler(
    async (req: Request, auth, reqLogger) => {
      const reqId = generateRequestId()

      // Step 1: Parse and validate request body
      let requestBody: unknown
      try {
        const text = await request.text()
        requestBody = text ? JSON.parse(text) : {}
      } catch (error) {
        reqLogger.error("connect.connector.connect_card.json_parsing_failed", {
          error: error instanceof Error ? error.message : String(error),
          orgId: auth?.orgId,
          requestId: reqId,
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
      let validatedRequest: ConnectCardRequest
      try {
        validatedRequest = ConnectCardRequestSchema.parse(requestBody)
      } catch (error) {
        reqLogger.error("connect.connector.connect_card.validation_failed", {
          error: error instanceof Error ? error.message : String(error),
          orgId: auth?.orgId,
          body: requestBody,
          requestId: reqId,
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
      if (!auth || !auth.token) {
        reqLogger.error("connect.connector.connect_card.authentication_failed", {
          error: "No authentication provided",
          requestId: reqId,
        })
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized" }, request_id: reqId },
          { status: 401 },
        )
      }

      if (!auth.orgId) {
        reqLogger.error("connect.connector.connect_card.org_context_failed", {
          error: "No organization context",
          requestId: reqId,
        })
        return NextResponse.json(
          {
            error: { code: "FORBIDDEN", message: "Organization context required" },
            request_id: reqId,
          },
          { status: 403 },
        )
      }

      try {
        reqLogger.info("connect.connector.connect_card.started", {
          orgId: auth.orgId,
          connectionId: validatedRequest.connection_id,
          requestId: reqId,
        })

        // Step 3: Get connection from database to verify ownership and get Fivetran connector ID
        const supabase = createBrowserClient({ authToken: auth.token })
        const { data: connection, error: dbError } = await supabase
          .from("data_connections")
          .select("id, org_id, fivetran_connector_id, source_type, status")
          .eq("id", validatedRequest.connection_id)
          .eq("org_id", auth.orgId)
          .single()

        if (dbError || !connection) {
          reqLogger.error("connect.connector.connect_card.connection_not_found", {
            error: dbError?.message,
            connectionId: validatedRequest.connection_id,
            orgId: auth.orgId,
            requestId: reqId,
          })
          return NextResponse.json(
            {
              error: {
                code: "CONNECTION_NOT_FOUND",
                message: "Connection not found or access denied",
              },
              request_id: reqId,
            },
            { status: 404 },
          )
        }

        if (!connection.fivetran_connector_id) {
          reqLogger.error("connect.connector.connect_card.no_fivetran_id", {
            connectionId: validatedRequest.connection_id,
            orgId: auth.orgId,
            requestId: reqId,
          })
          return NextResponse.json(
            {
              error: {
                code: "NO_FIVETRAN_CONNECTOR",
                message: "No Fivetran connector ID found for this connection",
              },
              request_id: reqId,
            },
            { status: 400 },
          )
        }

        // Step 4: Generate Connect Card URL from Fivetran
        const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/connect`
        const result = await fivetranGetConnectCardUrl(
          connection.fivetran_connector_id,
          redirectUrl,
        )

        reqLogger.info("connect.connector.connect_card.succeeded", {
          connectionId: validatedRequest.connection_id,
          fivetranConnectorId: connection.fivetran_connector_id,
          requestId: reqId,
        })

        // Step 5: Return Connect Card URL
        return NextResponse.json(
          {
            connect_card_url: result.connect_card_uri,
            connection_id: validatedRequest.connection_id,
            request_id: reqId,
          },
          { status: 200 },
        )
      } catch (error) {
        const errorDetails =
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error

        reqLogger.error("connect.connector.connect_card.failed", {
          error: error instanceof Error ? error.message : String(error),
          orgId: auth.orgId,
          connectionId: validatedRequest.connection_id,
          errorDetails,
          requestId: reqId,
        })

        return NextResponse.json(
          {
            error: {
              code: "CONNECT_CARD_GENERATION_FAILED",
              message: "Failed to generate Connect Card URL",
              details: errorDetails,
            },
            request_id: reqId,
          },
          { status: 500 },
        )
      }
    },
    { requireAuth: true, requireOrg: true },
  )(request)
}
