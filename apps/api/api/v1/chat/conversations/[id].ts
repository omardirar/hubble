/**
 * Conversation by ID API Function for Vercel (Modernized with Middleware)
 *
 * Handles updating specific conversations with modern middleware patterns.
 *
 * Features:
 * - JWT authentication with automatic user/org extraction
 * - Parameter validation for conversation ID
 * - Structured logging with correlation IDs
 * - Standardized error responses
 * - Rate limiting protection
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import {
  withErrorHandling,
  withMethods,
  withAuth,
  withRequestLogging,
  withRateLimit,
  RateLimits,
  sendSuccess,
  sendError,
  logger,
  AuthenticatedRequest,
} from "@hubble/utils/server"

/**
 * PATCH /v1/chat/conversations/[id] - Update conversation
 */
async function handleUpdateConversation(req: AuthenticatedRequest, res: VercelResponse) {
  const { id } = req.query
  const { supabase } = req.auth
  const requestLogger = logger.child({ endpoint: `/v1/chat/conversations/${id}`, method: "PATCH" })

  // Validate conversation ID parameter
  if (!id || typeof id !== "string") {
    return sendError(res, {
      code: "INVALID_PARAM",
      message: "Invalid conversation ID",
      status: 400,
    })
  }

  requestLogger.info("Updating conversation", { conversationId: id })

  const body = req.body || {}
  const updates: Record<string, unknown> = {}

  // Validate and prepare updates
  if (typeof body.title === "string") {
    updates.title = body.title.trim()
  }
  if (typeof body.archived === "boolean") {
    updates.archived_at = body.archived ? new Date().toISOString() : null
  }

  // Ensure we have at least one field to update
  if (Object.keys(updates).length === 0) {
    return sendError(res, {
      code: "NO_UPDATES",
      message: "No valid fields provided for update",
      status: 400,
    })
  }

  const { data, error } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    requestLogger.error("Database error updating conversation", {
      conversationId: id,
      error: error.message,
      updates,
    })

    // Handle specific database errors
    if (error.code === "PGRST116") {
      return sendError(res, { code: "NOT_FOUND", message: "Conversation not found", status: 404 })
    }

    return sendError(res, {
      code: "DATABASE_ERROR",
      message: "Failed to update conversation",
      status: 500,
    })
  }

  requestLogger.info("Successfully updated conversation", { conversationId: id, updates })
  return sendSuccess(res, data)
}

/**
 * Composed handler with all middleware
 */
const handler = compose(
  withRequestLogging,
  withErrorHandling,
  withRateLimit(RateLimits.STANDARD), // 100 requests/minute for CRUD operations
  withMethods(["PATCH"]),
  withAuth,
)(handleUpdateConversation)

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
