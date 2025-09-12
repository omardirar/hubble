import { handleEnable } from "./routes/v1/connect/enable"
import { handleStatus } from "./routes/v1/connect/status"
import { handleSecretsExample } from "./routes/v1/example-secrets"
import { handleChat } from "./routes/v1/chat/route"
import { handleConversations } from "./routes/v1/chat/conversations/route"
import { handleConversationById } from "./routes/v1/chat/conversations/[id]/route"
import { handleMessages } from "./routes/v1/chat/messages/[conversationId]/route"
import { type SecretsStoreEnv } from "@hubble/env"

export interface Env extends SecretsStoreEnv {
  // Environment variables
  ENVIRONMENT: string
  API_BASE_URL: string
  LOG_LEVEL: string
  CACHE_TTL: string

  // KV Namespaces
  CACHE_KV: KVNamespace
  SESSION_KV: KVNamespace

  // D1 Databases
  WORKFLOW_DB: D1Database

  // R2 Buckets
  TEMP_STORAGE: R2Bucket
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url

  // Connect routes
  if (pathname.startsWith("/v1/connect/enable")) {
    return handleEnable(request, env)
  }
  if (pathname.startsWith("/v1/connect/status")) {
    return handleStatus(request, env)
  }

  // Chat routes
  if (pathname === "/v1/chat") {
    return handleChat(request, env)
  }
  if (pathname.startsWith("/v1/chat/conversations/") && pathname.split("/").length === 5) {
    const id = pathname.split("/")[4]
    return handleConversationById(request, env, { id })
  }
  if (pathname.startsWith("/v1/chat/conversations")) {
    return handleConversations(request, env)
  }
  if (pathname.startsWith("/v1/chat/messages/")) {
    const conversationId = pathname.split("/")[4]
    return handleMessages(request, env, { conversationId })
  }

  // Example routes
  if (pathname.startsWith("/v1/example/secrets")) {
    return handleSecretsExample(request, env)
  }

  return new Response("Not found", { status: 404 })
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => route(request, env, ctx),
}
