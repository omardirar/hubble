/**
 * AI Chat API Route Handler with Message Persistence
 *
 * Uses AI SDK v5 with streamText and message persistence.
 * Implements streaming chat responses with database storage.
 */

import { anthropic } from "@ai-sdk/anthropic"
import { streamText, convertToModelMessages, type ToolSet, type UIMessage } from "ai"
import { getAnthropicConfig, getMotherduckMcpConfig } from "@hubble/config"
import {
  connectMcp,
  createApiHandler,
  getMessages,
  createMessage,
  updateConversation,
  type McpConnection,
} from "@hubble/server"
import { chatLogger } from "@hubble/logger"
import { createServiceClient } from "@hubble/db"
import { createHash } from "crypto"

export const runtime = "nodejs"

interface RequestLogger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

interface MotherduckSecrets {
  serviceSecret: string | null
  databaseName: string | null
}

const MOTHERDUCK_SECRET_NAME = "md_sa_token"

let supabaseServiceClient: ReturnType<typeof createServiceClient> | null = null

function getSupabaseServiceClient() {
  if (!supabaseServiceClient) {
    supabaseServiceClient = createServiceClient()
  }
  return supabaseServiceClient
}

export async function POST(req: Request) {
  return createApiHandler(
    async (request, auth, logger) => {
      const body = await req.json()
      const { messages, conversationId } = body

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return new Response(JSON.stringify({ error: "Messages array required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (!conversationId) {
        return new Response(JSON.stringify({ error: "Conversation ID required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Validate conversationId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(conversationId)) {
        return new Response(JSON.stringify({ error: "Invalid conversation ID format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Load previous messages from database to check for duplicates
      const previousMessages = await getMessages(auth!.supabase, conversationId, logger)

      // Get the last user message
      const lastUserMessage = messages[messages.length - 1] as UIMessage
      if (!lastUserMessage || lastUserMessage.role !== "user") {
        return new Response(JSON.stringify({ error: "Last message must be from user" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Extract text from message parts
      const messageText =
        lastUserMessage.parts
          ?.filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("") || ""

      chatLogger.messageReceived(conversationId, messageText.length, {
        userId: auth!.userId,
        orgId: auth!.orgId,
      })
      const { model } = getAnthropicConfig()
      const motherduckConfig = getMotherduckMcpConfig()

      let mcpTools: ToolSet | undefined
      let mcpInstructions: string | undefined
      let hasMcpCredentials = false

      const mcpHeaders = { ...motherduckConfig.headers }

      const supabaseSecrets = await fetchMotherduckSecrets(auth!.orgId, logger)

      if (supabaseSecrets.serviceSecret && supabaseSecrets.databaseName) {
        delete mcpHeaders["X-MotherDuck-Service-Secret"]
        delete mcpHeaders["X-MotherDuck-Connection"]
        mcpHeaders.Authorization = `Bearer ${supabaseSecrets.serviceSecret}`
        mcpHeaders["X-Db-Name"] = supabaseSecrets.databaseName
        hasMcpCredentials = true
      } else if (
        mcpHeaders["X-MotherDuck-Service-Secret"] &&
        mcpHeaders["X-MotherDuck-Connection"]
      ) {
        hasMcpCredentials = true
      } else if (mcpHeaders.Authorization && mcpHeaders["X-Db-Name"]) {
        hasMcpCredentials = true
      }

      let mcpConnection: McpConnection | null = null

      const closeMcpClient = async () => {
        if (!mcpConnection) {
          return
        }

        try {
          await mcpConnection.client.close()
        } catch (closeError) {
          logger.warn("mcp.client_close_failed", {
            conversationId,
            error: toError(closeError).message,
          })
        } finally {
          mcpConnection = null
        }
      }

      if (hasMcpCredentials) {
        try {
          mcpConnection = await connectMcp({
            url: motherduckConfig.url,
            headers: mcpHeaders,
            logger,
            clientName: "hubble-chat-motherduck",
            clientVersion: "1.0.0",
          })

          mcpTools = mcpConnection.tools as ToolSet
          mcpInstructions = mcpConnection.instructions

          logger.info("mcp.client_connected", {
            conversationId,
            toolCount: Object.keys(mcpTools).length,
          })
        } catch (error) {
          await closeMcpClient()
          hasMcpCredentials = false
          chatLogger.chatError("mcp_initialization_failed", toError(error), {
            conversationId,
            userId: auth!.userId,
            orgId: auth!.orgId,
          })
        }
      } else {
        logger.info("mcp.client_skipped_missing_credentials", {
          conversationId,
          orgId: auth!.orgId,
        })
      }

      // Convert UI messages to model messages
      const modelMessages = convertToModelMessages(messages as UIMessage[])

      // Create deterministic message ID for the assistant response
      const assistantMessageId = generateDeterministicMessageId(conversationId, messages.length)

      // Stream the response
      const result = streamText({
        model: anthropic(model || "claude-3-5-sonnet-20241022"),
        messages: modelMessages,
        system: "You are Hubble, an AI copilot for marketing teams.",
        temperature: 0.7,
        tools: mcpTools,
        system: mcpInstructions || undefined,
        async onError(error) {
          await closeMcpClient()
          chatLogger.chatError("chat_stream_error", toError(error), {
            conversationId,
            userId: auth!.userId,
            orgId: auth!.orgId,
          })
        },
        async onAbort() {
          await closeMcpClient()
        },
        async onFinish({ text, usage, finishReason }) {
          try {
            // Save user message if it's new
            const userMessageId = lastUserMessage.id
            const existingUserMsg = previousMessages.find(
              (m) => m.idempotency_key === userMessageId,
            )

            if (!existingUserMsg) {
              await createMessage(
                auth!.supabase,
                conversationId,
                messageText,
                "user",
                userMessageId,
                auth!.orgId,
                auth!.userId,
                logger,
              )
            }

            // Save assistant message
            await createMessage(
              auth!.supabase,
              conversationId,
              text,
              "assistant",
              assistantMessageId,
              auth!.orgId,
              auth!.userId,
              logger,
              {
                timestamp: Date.now(),
                modelId: model || "claude-3-5-sonnet-20241022",
                finishReason,
                usage,
              },
            )

            // Update conversation timestamp
            await updateConversation(
              auth!.supabase,
              conversationId,
              { updated_at: new Date().toISOString() },
              logger,
            )

            logger.info("Messages saved to database", {
              conversationId,
              messageCount: 2,
              userId: auth!.userId,
              orgId: auth!.orgId,
            })
          } catch (error) {
            chatLogger.chatError("message_storage_failed", toError(error), {
              conversationId,
              userId: auth!.userId,
              orgId: auth!.orgId,
            })
          } finally {
            await closeMcpClient()
          }
        },
      })

      return result.toUIMessageStreamResponse({
        originalMessages: messages as UIMessage[],
        generateMessageId: () => assistantMessageId,
      })
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/v1/chat" },
    },
  )(req)
}

// Create deterministic message ID generator for assistant messages
function generateDeterministicMessageId(conversationId: string, messageCount: number) {
  const context = `${conversationId}-${messageCount}`
  const hash = createHash("sha256").update(context).digest("hex")
  return `msg-${hash.slice(0, 16)}`
}

async function fetchMotherduckSecrets(
  orgId: string,
  requestLogger: RequestLogger,
): Promise<MotherduckSecrets> {
  try {
    const supabase = getSupabaseServiceClient()

    const [secretResult, databaseResult] = await Promise.all([
      supabase.rpc("get_secret", { p_org_id: orgId, p_secret_name: MOTHERDUCK_SECRET_NAME }),
      supabase
        .from("data_destinations")
        .select("md_db_name")
        .eq("org_id", orgId)
        .limit(1)
        .maybeSingle(),
    ])

    let serviceSecret: string | null = null
    if (secretResult.error) {
      requestLogger.warn("mcp.motherduck.secret_fetch_failed", {
        orgId,
        error: secretResult.error.message,
      })
    } else if (typeof secretResult.data === "string" && secretResult.data.length > 0) {
      serviceSecret = secretResult.data
    }

    let databaseName: string | null = null
    if (databaseResult.error) {
      requestLogger.warn("mcp.motherduck.database_lookup_failed", {
        orgId,
        error: databaseResult.error.message,
      })
    } else if (
      databaseResult.data &&
      typeof (databaseResult.data as { md_db_name?: unknown }).md_db_name === "string"
    ) {
      databaseName = (databaseResult.data as { md_db_name: string }).md_db_name
    }

    return { serviceSecret, databaseName }
  } catch (error) {
    requestLogger.error("mcp.motherduck.secret_fetch_exception", {
      orgId,
      error: toError(error).message,
    })
    return { serviceSecret: null, databaseName: null }
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  if (typeof error === "string") {
    return new Error(error)
  }

  try {
    return new Error(JSON.stringify(error))
  } catch {
    return new Error("Unknown error")
  }
}
