/**
 * Conversations API Route Handler
 *
 * Handles listing and creating chat conversations.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  createApiHandler,
  parseRequestBody,
  verifyOrganization,
  handleDatabaseError,
  getConversations,
  createConversation,
} from "@hubble/utils/server"
import {
  validateCreateConversationRequest,
  validateConversationSummary,
} from "@hubble/api-contracts/chat"

export async function GET(request: NextRequest) {
  return createApiHandler(
    async (_req: NextRequest, auth, logger) => {
      logger.info("Fetching conversations", {
        userId: auth!.userId,
        orgId: auth!.orgId,
      })

      try {
        const conversations = await getConversations(auth!.supabase, logger)
        const validatedData = conversations.map(validateConversationSummary)

        logger.info("Successfully fetched conversations", { count: validatedData.length })
        return NextResponse.json(validatedData)
      } catch (error) {
        return handleDatabaseError(error, "fetch conversations", logger)
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/v1/chat/conversations" },
    },
  )(request)
}

export async function POST(request: NextRequest) {
  return createApiHandler(
    async (req: NextRequest, auth, logger) => {
      // Parse and validate request body
      const { title = "New Chat" } = await parseRequestBody(
        req,
        validateCreateConversationRequest,
        logger,
      )

      logger.info("Creating conversation", {
        userId: auth!.userId,
        orgId: auth!.orgId,
        title,
      })

      // Verify organization exists in Clerk mirror
      const orgExists = await verifyOrganization(auth!.supabase, auth!.orgId, logger)
      if (!orgExists) {
        return NextResponse.json(
          { error: "Organization not found", code: "ORG_NOT_FOUND" },
          { status: 404 },
        )
      }

      try {
        const conversation = await createConversation(
          auth!.supabase,
          title,
          auth!.userId,
          auth!.orgId,
          logger,
        )

        logger.info("Successfully created conversation", { id: conversation.id })
        return NextResponse.json(conversation, { status: 201 })
      } catch (error) {
        return handleDatabaseError(error, "create conversation", logger)
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/v1/chat/conversations" },
    },
  )(request)
}
