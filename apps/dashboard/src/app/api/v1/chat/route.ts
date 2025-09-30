/**
 * AI Chat API Route Handler
 *
 * This route processes chat requests by forwarding them to the Anthropic API
 * for AI-powered responses.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  createApiHandler,
  parseRequestBody,
  chatWithAnthropic,
  checkRateLimit,
} from "@hubble/server"
import { validateChatRequest, validateChatResponse } from "@hubble/schemas/chat"
import { chatLogger } from "@hubble/logger"

export async function POST(request: NextRequest) {
  return createApiHandler(
    async (req: NextRequest, auth, logger) => {
      // Parse and validate request body
      const { text } = await parseRequestBody(req, validateChatRequest, logger)
      const prompt = text.trim()

      // Rate limiting check
      const rateLimitKey = `chat:${auth!.userId}`
      if (!checkRateLimit(rateLimitKey, 20, 60000)) {
        // 20 requests per minute
        chatLogger.chatError("rate_limit_exceeded", new Error("Rate limit exceeded"), {
          userId: auth!.userId,
          orgId: auth!.orgId,
          rateLimitKey,
        })
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 },
        )
      }

      // Additional input validation
      if (prompt.length === 0) {
        chatLogger.chatError("validation_failed", new Error("Empty message"), {
          userId: auth!.userId,
          orgId: auth!.orgId,
        })
        return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
      }

      if (prompt.length > 10000) {
        chatLogger.chatError("validation_failed", new Error("Message too long"), {
          userId: auth!.userId,
          orgId: auth!.orgId,
          promptLength: prompt.length,
        })
        return NextResponse.json(
          { error: "Message too long (max 10,000 characters)" },
          { status: 400 },
        )
      }

      // Log AI response generation start
      chatLogger.aiResponseStart("unknown", prompt.length, {
        userId: auth!.userId,
        orgId: auth!.orgId,
      })

      // Get AI response
      const reply = await chatWithAnthropic(prompt, logger)

      // Validate response data against schema
      const validatedResponse = validateChatResponse({ reply })

      // Log AI response completion
      chatLogger.aiResponseComplete("unknown", validatedResponse.reply.length, 0, {
        userId: auth!.userId,
        orgId: auth!.orgId,
      })

      return NextResponse.json(validatedResponse)
    },
    {
      requireAuth: true,
      loggerContext: { endpoint: "/api/v1/chat" },
    },
  )(request)
}
