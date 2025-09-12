/**
 * Hubble API Worker - Main Entry Point
 *
 * This Cloudflare Worker serves as the backend API for the Hubble application.
 * It handles all server-side operations including database access, AI chat,
 * connection management, and other business logic.
 *
 * Architecture:
 * - Centralized API worker for all backend operations
 * - Uses Cloudflare Secrets Store for secure secret management
 * - Implements proxy pattern: Web app → API worker → Supabase
 * - All sensitive operations are handled server-side
 * - Supports both traditional and Cloudflare-specific bindings
 *
 * Security:
 * - All secrets accessed via Cloudflare Secrets Store
 * - RLS policies enforced through Supabase client configuration
 * - JWT tokens propagated from web app for user context
 * - No direct client-side database access
 */

import { handleEnable } from "./routes/v1/connect/enable"
import { handleStatus } from "./routes/v1/connect/status"
import { handleSecretsExample } from "./routes/v1/example-secrets"
import { handleChat } from "./routes/v1/chat/route"
import { handleConversations } from "./routes/v1/chat/conversations/route"
import { handleConversationById } from "./routes/v1/chat/conversations/[id]/route"
import { handleMessages } from "./routes/v1/chat/messages/[conversationId]/route"
import { type SecretsStoreEnv } from "@hubble/env"

/**
 * Environment interface for the API Worker
 *
 * This interface extends SecretsStoreEnv to include all the bindings
 * and environment variables available to the Cloudflare Worker.
 *
 * Bindings:
 * - Secrets Store: Sensitive data (API keys, database credentials)
 * - KV Namespaces: Caching and session storage
 * - D1 Databases: Relational data storage
 * - R2 Buckets: File and object storage
 * - Environment variables: Public configuration
 */
export interface Env extends SecretsStoreEnv {
  // Environment variables (public configuration)
  ENVIRONMENT: string // Deployment environment (preview/production)
  API_BASE_URL: string // Base URL for API endpoints
  LOG_LEVEL: string // Logging level (debug/info/warn/error)
  CACHE_TTL: string // Cache time-to-live in seconds

  // KV Namespaces (key-value storage)
  CACHE_KV: KVNamespace // General purpose caching
  SESSION_KV: KVNamespace // User session storage

  // D1 Databases (SQL database)
  WORKFLOW_DB: D1Database // Workflow and process data

  // R2 Buckets (object storage)
  TEMP_STORAGE: R2Bucket // Temporary file storage
}

/**
 * Main routing function for the API Worker
 *
 * This function handles all incoming requests and routes them to the appropriate
 * handler based on the URL path. It implements a simple but effective routing
 * system that supports both exact matches and path prefixes.
 *
 * Routing strategy:
 * - Exact matches for specific endpoints (e.g., /v1/chat)
 * - Prefix matching for resource collections (e.g., /v1/chat/conversations)
 * - Parameter extraction for dynamic routes (e.g., /v1/chat/conversations/:id)
 * - Fallback to 404 for unmatched routes
 *
 * @param request - The incoming HTTP request
 * @param env - The Cloudflare Workers environment
 * @param ctx - The execution context
 * @returns Promise that resolves to an HTTP response
 */
async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Parse the request URL to extract pathname for routing
  const url = new URL(request.url)
  const { pathname } = url

  // Connect routes - Handle data source connection management
  if (pathname.startsWith("/v1/connect/enable")) {
    return handleEnable(request, env)
  }
  if (pathname.startsWith("/v1/connect/status")) {
    return handleStatus(request, env)
  }

  // Chat routes - Handle AI chat functionality
  if (pathname === "/v1/chat") {
    return handleChat(request, env)
  }

  // Dynamic conversation routes - Handle specific conversation by ID
  // Pattern: /v1/chat/conversations/:id
  if (pathname.startsWith("/v1/chat/conversations/") && pathname.split("/").length === 5) {
    const id = pathname.split("/")[4] // Extract conversation ID from URL
    return handleConversationById(request, env, { id })
  }

  // Conversation collection routes - Handle conversation listing and creation
  if (pathname.startsWith("/v1/chat/conversations")) {
    return handleConversations(request, env)
  }

  // Message routes - Handle messages within a conversation
  // Pattern: /v1/chat/messages/:conversationId
  if (pathname.startsWith("/v1/chat/messages/")) {
    const conversationId = pathname.split("/")[4] // Extract conversation ID from URL
    return handleMessages(request, env, { conversationId })
  }

  // Example routes - Development and testing endpoints
  if (pathname.startsWith("/v1/example/secrets")) {
    return handleSecretsExample(request, env)
  }

  // Return 404 for unmatched routes
  return new Response("Not found", { status: 404 })
}

/**
 * Cloudflare Workers export
 *
 * This is the main export that Cloudflare Workers uses to handle incoming requests.
 * It provides the fetch handler that processes all HTTP requests to the worker.
 */
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => route(request, env, ctx),
}
