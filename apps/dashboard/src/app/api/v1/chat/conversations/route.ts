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
} from "@hubble/server"
import {
  validateCreateConversationRequest,
  validateConversationSummary,
} from "@hubble/schemas/chat"
import { chatLogger, databaseLogger } from "@hubble/logger"

export async function GET(request: NextRequest) {
  return createApiHandler(
    async (_req: NextRequest, auth, logger) => {
      databaseLogger.queryStart("select", "conversations", {
        userId: auth!.userId,
        orgId: auth!.orgId,
      })

      try {
        const conversations = await getConversations(auth!.supabase, logger)
        const validatedData = conversations.map(validateConversationSummary)

        databaseLogger.queryComplete("select", "conversations", 0, validatedData.length, {
          userId: auth!.userId,
          orgId: auth!.orgId,
        })

        return NextResponse.json(validatedData)
      } catch (error) {
        databaseLogger.queryFailed("select", "conversations", error as Error, {
          userId: auth!.userId,
          orgId: auth!.orgId,
        })
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

      chatLogger.conversationCreated("pending", auth!.userId, title, {
        orgId: auth!.orgId,
      })

      // Verify organization exists in Clerk mirror
      const orgExists = await verifyOrganization(auth!.supabase, auth!.orgId, logger)
      if (!orgExists) {
        chatLogger.chatError("organization_not_found", new Error("Organization not found"), {
          userId: auth!.userId,
          orgId: auth!.orgId,
        })
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

        chatLogger.conversationCreated(conversation.id, auth!.userId, title, {
          orgId: auth!.orgId,
        })
        return NextResponse.json(conversation, { status: 201 })
      } catch (error) {
        chatLogger.chatError("conversation_creation_failed", error as Error, {
          userId: auth!.userId,
          orgId: auth!.orgId,
          title,
        })
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
