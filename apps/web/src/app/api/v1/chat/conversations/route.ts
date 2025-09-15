import { createProxyHandler } from "@hubble/utils/server"

/**
 * Web App API Route: Chat Conversations Proxy (Modernized)
 *
 * Handles both GET and POST requests for chat conversations using
 * standardized proxy utilities for consistent behavior.
 *
 * Features:
 * - GET: List user's conversations
 * - POST: Create new conversation
 * - Automatic JWT authentication with Clerk
 * - Standardized error responses and logging
 * - Proper request forwarding to API functions
 */

// Create proxy handlers for both GET and POST methods
export const GET = createProxyHandler("/v1/chat/conversations")
export const POST = createProxyHandler("/v1/chat/conversations")
