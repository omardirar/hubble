/**
 * AI Chat API Route Handler with Message Persistence
 *
 * Uses AI SDK v5 with streamText and message persistence.
 * Implements streaming chat responses with database storage.
 */

import { anthropic } from "@ai-sdk/anthropic"
import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { getAnthropicConfig } from "@hubble/config"
import { createApiHandler, getMessages, createMessage, updateConversation } from "@hubble/server"
import { chatLogger } from "@hubble/logger"
import { createHash } from "crypto"

export const runtime = "nodejs"

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

      // Convert UI messages to model messages
      const modelMessages = convertToModelMessages(messages as UIMessage[])

      // Create deterministic message ID for the assistant response
      const assistantMessageId = generateDeterministicMessageId(conversationId, messages.length)

      // Stream the response
      const result = streamText({
        model: anthropic(model || "claude-3-5-sonnet-20241022"),
        messages: modelMessages,
        temperature: 0.7,
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
            chatLogger.chatError("message_storage_failed", error as Error, {
              conversationId,
              userId: auth!.userId,
              orgId: auth!.orgId,
            })
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
