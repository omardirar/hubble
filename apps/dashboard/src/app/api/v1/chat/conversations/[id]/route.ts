/**
 * Conversation by ID API Route Handler
 *
 * Handles updating specific conversations.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  createApiHandler,
  handleDatabaseError,
  updateConversation,
  ApiErrorCodes,
} from "@hubble/utils/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  return createApiHandler(
    async (req: NextRequest, auth, logger) => {
      // Parse request body
      const body = await req.json()
      const updates: Record<string, unknown> = {}

      // Validate and prepare updates
      if (body.title !== undefined) {
        updates.title = body.title
      }
      if (body.archived_at !== undefined) {
        updates.archived_at = body.archived_at
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: "No valid updates provided", code: ApiErrorCodes.VALIDATION_ERROR },
          { status: 400 },
        )
      }

      logger.info("Updating conversation", {
        userId: auth!.userId,
        id,
        updates,
      })

      try {
        const conversation = await updateConversation(auth!.supabase, id, updates, logger)

        logger.info("Successfully updated conversation", { id })
        return NextResponse.json(conversation)
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return NextResponse.json(
            { error: "Conversation not found", code: ApiErrorCodes.NOT_FOUND },
            { status: 404 },
          )
        }
        return handleDatabaseError(error, "update conversation", logger)
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/v1/chat/conversations/[id]" },
    },
  )(request)
}
