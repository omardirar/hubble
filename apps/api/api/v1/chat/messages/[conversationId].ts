/**
 * Messages API Function for Vercel (Modernized with Middleware)
 *
 * Handles listing and creating messages within conversations with modern middleware patterns.
 *
 * Features:
 * - JWT authentication with automatic user/org extraction
 * - Parameter validation for conversation ID
 * - Request validation with Zod schemas
 * - Idempotency key handling for message creation
 * - Structured logging with correlation IDs
 * - Standardized error responses
 * - Rate limiting protection
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import {
  withErrorHandling,
  withMethods,
  withAuth,
  withValidation,
  withRequestLogging,
  withRateLimit,
  RateLimits,
  sendSuccess,
  sendError,
  logger,
  AuthenticatedRequest,
} from "@hubble/utils/server"
import { contentToText } from "@hubble/utils"
import {
  type ApiMessage,
  type CreateMessageRequest,
  type CreateMessageResponse,
  validateCreateMessageRequest,
  validateApiMessage,
} from "@hubble/api-contracts/chat"

/**
 * GET /v1/chat/messages/[conversationId] - List messages in conversation
 */
async function handleGetMessages(req: AuthenticatedRequest, res: VercelResponse) {
  const { conversationId } = req.query
  const { supabase } = req.auth
  const requestLogger = logger.child({
    endpoint: `/v1/chat/messages/${conversationId}`,
    method: "GET",
  })

  // Validate conversation ID parameter
  if (!conversationId || typeof conversationId !== "string") {
    return sendError(res, {
      code: "INVALID_PARAM",
      message: "Invalid conversation ID",
      status: 400,
    })
  }

  requestLogger.info("Fetching messages", { conversationId })

  const { data, error } = await supabase
    .from("messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (error) {
    requestLogger.error("Database error fetching messages", {
      conversationId,
      error: error.message,
    })
    return sendError(res, {
      code: "DATABASE_ERROR",
      message: "Failed to fetch messages",
      status: 500,
    })
  }

  // Transform and validate messages
  const msgs: ApiMessage[] = (data || []).map((r: any) => ({
    id: r.id,
    role: r.role as "user" | "assistant" | "system",
    text: contentToText(r.content),
    created_at: r.created_at,
  }))

  const validatedData = msgs.map(validateApiMessage)
  requestLogger.info("Successfully fetched messages", {
    conversationId,
    count: validatedData.length,
  })

  return sendSuccess(res, validatedData)
}

/**
 * POST /v1/chat/messages/[conversationId] - Create message in conversation
 */
async function handleCreateMessage(
  req: AuthenticatedRequest & { validated: CreateMessageRequest },
  res: VercelResponse,
) {
  const { conversationId } = req.query
  const { supabase } = req.auth
  const { role = "user", text = "", idempotencyKey = null } = req.validated
  const requestLogger = logger.child({
    endpoint: `/v1/chat/messages/${conversationId}`,
    method: "POST",
  })

  // Validate conversation ID parameter
  if (!conversationId || typeof conversationId !== "string") {
    return sendError(res, {
      code: "INVALID_PARAM",
      message: "Invalid conversation ID",
      status: 400,
    })
  }

  requestLogger.info("Creating message", {
    conversationId,
    role,
    textLength: text.length,
    hasIdempotencyKey: !!idempotencyKey,
  })

  const { data, error } = await supabase.rpc("rpc_append_message", {
    p_conversation_id: conversationId,
    p_role: role,
    p_content: { text },
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    // Handle idempotency conflict by fetching the existing message
    if ((error.code === "23505" || error.message?.includes("idempotency")) && idempotencyKey) {
      requestLogger.info("Idempotency conflict - fetching existing message", {
        conversationId,
        idempotencyKey,
      })

      const { data: existingMessage, error: fetchError } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", conversationId)
        .eq("idempotency_key", idempotencyKey)
        .single()

      if (fetchError) {
        requestLogger.error("Failed to fetch existing message after idempotency conflict", {
          conversationId,
          idempotencyKey,
          error: fetchError.message,
        })
        return sendError(res, {
          code: "DATABASE_ERROR",
          message: "Failed to fetch existing message",
          status: 500,
        })
      }

      requestLogger.info("Returning existing message due to idempotency", {
        conversationId,
        messageId: existingMessage.id,
      })

      return sendSuccess(res, {
        id: existingMessage.id,
        role: existingMessage.role,
        content: existingMessage.content,
        created_at: existingMessage.created_at,
      })
    }

    requestLogger.error("Database error creating message", {
      conversationId,
      error: error.message,
      errorCode: error.code,
    })
    return sendError(res, {
      code: "DATABASE_ERROR",
      message: "Failed to create message",
      status: 500,
    })
  }

  const validatedData: CreateMessageResponse = data
  requestLogger.info("Successfully created message", {
    conversationId,
    messageId: validatedData.id,
  })

  return sendSuccess(res, validatedData, 201)
}

/**
 * Main handler that routes to GET or POST logic
 */
async function handleMessages(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleGetMessages(req, res)
  } else if (req.method === "POST") {
    // Apply validation middleware for POST requests only
    const validationMiddleware = withValidation(validateCreateMessageRequest, "body")
    const validatedHandler = validationMiddleware(handleCreateMessage as any)
    return validatedHandler(req, res)
  }
}

/**
 * Composed handler with all middleware
 */
const handler = compose(
  withRequestLogging,
  withErrorHandling,
  withRateLimit(RateLimits.STANDARD), // 100 requests/minute for CRUD operations
  withMethods(["GET", "POST"]),
  withAuth,
)(handleMessages)

/**
 * Middleware composition helper
 */
function compose(...middlewares: any[]) {
  return middlewares.reduce(
    (a, b) =>
      (...args: any[]) =>
        a(b(...args)),
  )
}

export default handler
