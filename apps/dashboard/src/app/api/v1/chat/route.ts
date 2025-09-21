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
} from "@hubble/utils/server"
import { validateChatRequest, validateChatResponse } from "@hubble/api-contracts/chat"

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
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 },
        )
      }

      // Additional input validation
      if (prompt.length === 0) {
        return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
      }

      if (prompt.length > 10000) {
        return NextResponse.json(
          { error: "Message too long (max 10,000 characters)" },
          { status: 400 },
        )
      }

      logger.info("Processing chat request", {
        userId: auth!.userId,
        orgId: auth!.orgId,
        promptLength: prompt.length,
      })

      // Get AI response
      const reply = await chatWithAnthropic(prompt, logger)

      // Validate response data against schema
      const validatedResponse = validateChatResponse({ reply })

      logger.info("Chat request completed successfully", {
        userId: auth!.userId,
        orgId: auth!.orgId,
        replyLength: validatedResponse.reply.length,
      })

      return NextResponse.json(validatedResponse)
    },
    {
      requireAuth: true,
      loggerContext: { endpoint: "/api/v1/chat" },
    },
  )(request)
}
