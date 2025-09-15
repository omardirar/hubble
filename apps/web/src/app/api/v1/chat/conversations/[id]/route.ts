import { createDynamicProxyHandler } from "@hubble/utils/server"

/**
 * Web App API Route: Chat Conversation by ID Proxy (Modernized)
 *
 * Handles PATCH requests for updating specific conversations using
 * standardized proxy utilities with parameter validation.
 *
 * Features:
 * - PATCH: Update conversation properties
 * - Automatic parameter extraction and validation
 * - Automatic JWT authentication with Clerk
 * - Standardized error responses and logging
 * - Proper request forwarding to API functions
 */

/**
 * Handle PATCH requests to /api/v1/chat/conversations/[id]
 * Uses dynamic proxy handler for parameter handling
 */
export const PATCH = createDynamicProxyHandler("/v1/chat/conversations/[id]")
