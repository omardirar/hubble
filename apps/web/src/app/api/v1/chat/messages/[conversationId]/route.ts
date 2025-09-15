import { createDynamicProxyHandler } from "@hubble/utils/server"

/**
 * Web App API Route: Chat Messages by Conversation ID Proxy (Modernized)
 *
 * Handles GET and POST requests for messages within a specific conversation
 * using standardized proxy utilities with parameter validation.
 *
 * Features:
 * - GET: List messages in conversation
 * - POST: Create new message in conversation
 * - Automatic parameter extraction and validation
 * - Automatic JWT authentication with Clerk
 * - Standardized error responses and logging
 * - Proper request forwarding to API functions
 */

// TODO: Add pagination via cursor query params
//   Context: Support `?cursor=<id>&limit=50` for incremental fetch and lazy-loading older messages.
//   labels: area/web, feature/chat, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

/**
 * Handle GET requests to /api/v1/chat/messages/[conversationId]
 * Uses dynamic proxy handler for parameter handling
 */
export const GET = createDynamicProxyHandler("/v1/chat/messages/[conversationId]")

/**
 * Handle POST requests to /api/v1/chat/messages/[conversationId]
 * Uses dynamic proxy handler for parameter handling
 */
export const POST = createDynamicProxyHandler("/v1/chat/messages/[conversationId]")
