/**
 * Messages API Route Handler
 *
 * Handles listing and creating messages within conversations.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  createApiHandler,
  parseRequestBody,
  handleDatabaseError,
  getMessages,
  createMessage,
  findExistingMessage,
  verifyConversationAccess,
  generateId,
  ApiErrorCodes,
} from "@hubble/server"
import { validateCreateMessageRequest, validateApiMessage } from "@hubble/schemas/chat"

interface RouteParams {
  params: Promise<{ conversationId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { conversationId } = await params

  return createApiHandler(
    async (_req: NextRequest, auth, logger) => {
      logger.info("Fetching messages", {
        userId: auth!.userId,
        conversationId,
      })

      // Verify user has access to conversation
      const hasAccess = await verifyConversationAccess(auth!.supabase, conversationId, logger)

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Conversation not found", code: ApiErrorCodes.NOT_FOUND },
          { status: 404 },
        )
      }

      try {
        const messages = await getMessages(auth!.supabase, conversationId, logger)

        // Transform database messages to API format
        const apiMessages = messages.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.content.text,
          created_at: message.created_at,
        }))

        const validatedData = apiMessages.map(validateApiMessage)

        logger.info("Successfully fetched messages", { count: validatedData.length })
        return NextResponse.json(validatedData)
      } catch (error) {
        return handleDatabaseError(error, "fetch messages", logger)
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/v1/chat/messages/[conversationId]" },
    },
  )(request)
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { conversationId } = await params

  return createApiHandler(
    async (req: NextRequest, auth, logger) => {
      // Parse and validate request body
      const {
        text,
        role = "user",
        idempotencyKey = generateId(),
      } = await parseRequestBody(req, validateCreateMessageRequest, logger)

      if (!text) {
        return NextResponse.json(
          { error: "Message text is required", code: ApiErrorCodes.VALIDATION_ERROR },
          { status: 400 },
        )
      }

      logger.info("Creating message", {
        userId: auth!.userId,
        conversationId,
        role,
        idempotencyKey,
      })

      // Verify user has access to conversation
      const hasAccess = await verifyConversationAccess(auth!.supabase, conversationId, logger)

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Conversation not found", code: ApiErrorCodes.NOT_FOUND },
          { status: 404 },
        )
      }

      // Check for idempotency
      const existing = await findExistingMessage(
        auth!.supabase,
        conversationId,
        idempotencyKey,
        logger,
      )

      if (existing) {
        logger.info("Idempotent request - returning existing message", {
          messageId: existing.id,
          idempotencyKey,
        })

        // Transform database message to API format
        const apiMessage = {
          id: existing.id,
          role: existing.role,
          text: existing.content.text,
          created_at: existing.created_at,
        }

        return NextResponse.json(apiMessage)
      }

      try {
        const message = await createMessage(
          auth!.supabase,
          conversationId,
          text,
          role,
          idempotencyKey,
          auth!.orgId,
          auth!.userId,
          logger,
        )

        // Transform database message to API format
        const apiMessage = {
          id: message.id,
          role: message.role,
          text: message.content.text,
          created_at: message.created_at,
        }

        logger.info("Successfully created message", { id: message.id })
        return NextResponse.json(apiMessage, { status: 201 })
      } catch (error) {
        return handleDatabaseError(error, "create message", logger)
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/v1/chat/messages/[conversationId]" },
    },
  )(request)
}
