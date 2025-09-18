/**
 * AI Chat API Route Handler
 *
 * This route processes chat requests by forwarding them to the Anthropic API
 * for AI-powered responses.
 */

import { NextRequest, NextResponse } from "next/server"
import { createApiHandler, parseRequestBody, chatWithAnthropic } from "@hubble/utils/server"
import { validateChatRequest, validateChatResponse } from "@hubble/api-contracts/chat"

export async function POST(request: NextRequest) {
  return createApiHandler(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (req: any, auth, logger) => {
      // Parse and validate request body
      const { text } = await parseRequestBody(req, validateChatRequest, logger)
      const prompt = text.trim()

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
