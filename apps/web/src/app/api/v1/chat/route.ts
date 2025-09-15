import { createProxyHandler } from "@hubble/utils/server"

/**
 * Web App API Route: Chat Proxy (Modernized)
 *
 * This Next.js API route acts as a proxy between the web application and the
 * Vercel API functions. It uses standardized proxy utilities for consistent
 * behavior and error handling across all proxy routes.
 *
 * Features:
 * - Automatic JWT authentication with Clerk
 * - Standardized error responses
 * - Request/response logging
 * - Proper request forwarding to API functions
 * - Type-safe error handling
 *
 * Architecture:
 * - Web app → Next.js API route → Vercel API function → Anthropic API
 * - JWT tokens are automatically propagated for user authentication
 * - All sensitive operations are handled by the API functions
 * - This route only handles request/response proxying
 */

/**
 * Handle POST requests to /api/v1/chat
 * Uses standardized proxy handler for consistent behavior
 */
export const POST = createProxyHandler("/v1/chat")
