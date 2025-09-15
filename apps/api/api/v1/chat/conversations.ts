/**
 * Conversations API Function for Vercel (Modernized with Middleware)
 *
 * Handles listing and creating chat conversations with modern middleware patterns.
 *
 * Features:
 * - JWT authentication with automatic user/org extraction
 * - Request validation with Zod schemas
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
import {
  type ConversationSummary,
  type CreateConversationRequest,
  type CreateConversationResponse,
  validateCreateConversationRequest,
  validateConversationSummary,
} from "@hubble/api-contracts/chat"

/**
 * GET /v1/chat/conversations - List conversations
 */
async function handleGetConversations(req: AuthenticatedRequest, res: VercelResponse) {
  const { userId, orgId, supabase } = req.auth
  const requestLogger = logger.child({ endpoint: "/v1/chat/conversations", method: "GET" })

  requestLogger.info("Fetching conversations", { userId, orgId })

  const { data, error } = await supabase
    .from("conversation_summaries")
    .select("id,title,updated_at,archived_at,last_message_text")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })

  if (error) {
    requestLogger.error("Database error fetching conversations", { error: error.message })
    return sendError(res, {
      code: "DATABASE_ERROR",
      message: "Failed to fetch conversations",
      status: 500,
    })
  }

  // Validate response data against schema
  const validatedData: ConversationSummary[] = (data || []).map(validateConversationSummary)
  requestLogger.info("Successfully fetched conversations", { count: validatedData.length })

  return sendSuccess(res, validatedData)
}

/**
 * POST /v1/chat/conversations - Create conversation
 */
async function handleCreateConversation(
  req: AuthenticatedRequest & { validated: CreateConversationRequest },
  res: VercelResponse,
) {
  const { userId, orgId, supabase } = req.auth
  const { title = "New Chat" } = req.validated
  const requestLogger = logger.child({ endpoint: "/v1/chat/conversations", method: "POST" })

  requestLogger.info("Creating conversation", { userId, orgId, title })

  // Verify organization exists in Clerk mirror
  const { data: orgData, error: orgError } = await supabase.rpc("get_org_from_clerk_mirror", {
    p_org_id: orgId,
  })

  if (orgError || !orgData) {
    requestLogger.error("Organization not found in Clerk mirror", { error: orgError?.message })
    return sendError(res, { code: "ORG_NOT_FOUND", message: "Organization not found", status: 404 })
  }

  // Insert conversation with user and organization information from JWT
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      title,
      owner_user_id: userId,
      org_id: orgId,
    })
    .select()
    .single()

  if (error) {
    requestLogger.error("Database error creating conversation", { error: error.message })
    return sendError(res, {
      code: "DATABASE_ERROR",
      message: "Failed to create conversation",
      status: 500,
    })
  }

  const validatedData: CreateConversationResponse = data
  requestLogger.info("Successfully created conversation", { id: validatedData.id })

  return sendSuccess(res, validatedData, 201)
}

/**
 * Main handler that routes to GET or POST logic
 */
async function handleConversations(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleGetConversations(req, res)
  } else if (req.method === "POST") {
    // Apply validation middleware for POST requests only
    const validationMiddleware = withValidation(validateCreateConversationRequest, "body")
    const validatedHandler = validationMiddleware(handleCreateConversation as any)
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
)(handleConversations)

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
