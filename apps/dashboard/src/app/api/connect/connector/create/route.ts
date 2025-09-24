/**
 * Create Fivetran Connector API Route
 *
 * Creates a new Fivetran connector for a specific data source.
 * This endpoint handles the initial connector creation and database record.
 *
 * Flow:
 * 1. Validate request and authentication
 * 2. Create data connection record in database
 * 3. Create Fivetran connector
 * 4. Update database with connector ID
 * 5. Return connector details
 *
 * @param request - HTTP request containing connector creation data
 * @returns JSON response with connector details
 */

import { NextResponse } from "next/server"
import {
  createApiHandler,
  createDataConnection,
  updateDataConnection,
  fivetranCreateConnector,
  getTenantByOrgId,
} from "@hubble/server"
import { generateRequestId } from "@hubble/core"
import { z } from "zod"

// Ensure Node.js runtime for SDK compatibility
export const runtime = "nodejs"

// Request validation schema
const CreateConnectorRequestSchema = z.object({
  source_type: z.string().min(1, "Source type is required"),
  config: z.record(z.string(), z.unknown()).optional().default({}),
})

type CreateConnectorRequest = z.infer<typeof CreateConnectorRequestSchema>

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
        reqLogger.error("connect.connector.create.json_parsing_failed", {
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
      let validatedRequest: CreateConnectorRequest
      try {
        validatedRequest = CreateConnectorRequestSchema.parse(requestBody)
      } catch (error) {
        reqLogger.error("connect.connector.create.validation_failed", {
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
      if (!auth) {
        reqLogger.error("connect.connector.create.authentication_failed", {
          error: "No authentication provided",
          requestId: reqId,
        })
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized" }, request_id: reqId },
          { status: 401 },
        )
      }

      if (!auth.orgId) {
        reqLogger.error("connect.connector.create.org_context_failed", {
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
        reqLogger.info("connect.connector.create.started", {
          orgId: auth.orgId,
          sourceType: validatedRequest.source_type,
          requestId: reqId,
        })

        // Step 3: Create data connection record in database
        const { id: connectionId } = await createDataConnection(
          auth.orgId,
          validatedRequest.source_type,
        )

        reqLogger.info("connect.connector.create.data_connection_created", {
          connectionId,
          requestId: reqId,
        })

        // Step 4: Get Fivetran destination ID for this organization
        const tenant = await getTenantByOrgId(auth.orgId)
        if (!tenant?.fivetran_destination_id) {
          reqLogger.error("connect.connector.create.no_destination", {
            orgId: auth.orgId,
            requestId: reqId,
          })
          return NextResponse.json(
            {
              error: {
                code: "NO_DESTINATION",
                message:
                  "No Fivetran destination found for this organization. Please complete provisioning first.",
              },
              request_id: reqId,
            },
            { status: 400 },
          )
        }

        // Step 5: Create Fivetran connector using the destination ID as group ID
        const { connector_id } = await fivetranCreateConnector(
          tenant.fivetran_destination_id, // Use destination ID as group_id
          validatedRequest.source_type,
          validatedRequest.config,
        )

        reqLogger.info("connect.connector.create.fivetran_connector_created", {
          connectorId: connector_id,
          requestId: reqId,
        })

        // Step 6: Update database with connector ID
        await updateDataConnection(connectionId, {
          fivetran_connector_id: connector_id,
          status: "needs_auth",
        })

        reqLogger.info("connect.connector.create.connection_updated", {
          connectionId,
          connectorId: connector_id,
          requestId: reqId,
        })

        // Step 7: Return success response
        const response = {
          connection_id: connectionId,
          connector_id: connector_id,
          source_type: validatedRequest.source_type,
          status: "needs_auth",
          request_id: reqId,
        }

        reqLogger.info("connect.connector.create.completed", {
          connectionId,
          connectorId: connector_id,
          requestId: reqId,
        })

        return NextResponse.json(response, { status: 201 })
      } catch (error) {
        const errorDetails =
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error

        reqLogger.error("connect.connector.create.failed", {
          error: error instanceof Error ? error.message : String(error),
          orgId: auth.orgId,
          sourceType: validatedRequest.source_type,
          errorDetails,
          requestId: reqId,
        })

        return NextResponse.json(
          {
            error: {
              code: "CONNECTOR_CREATION_FAILED",
              message: "Failed to create connector",
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
