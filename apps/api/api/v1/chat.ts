/**
 * AI Chat API Function for Vercel (Modernized with Middleware)
 *
 * This function processes chat requests by forwarding them to the Anthropic API
 * for AI-powered responses. Uses modern middleware patterns for clean, maintainable code.
 *
 * Features:
 * - Automatic request validation with Zod schemas
 * - Structured logging with correlation IDs
 * - Rate limiting protection
 * - Standardized error handling
 * - Type-safe authentication
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import {
  withErrorHandling,
  withMethods,
  withValidation,
  withRequestLogging,
  withRateLimit,
  RateLimits,
  sendSuccess,
  sendError,
  logger,
} from "@hubble/utils/server"
import {
  type ChatRequest,
  type ChatResponse,
  validateChatRequest,
  validateChatResponse,
} from "@hubble/api-contracts/chat"
import { getAnthropicConfig } from "@hubble/env"

/**
 * Core chat business logic (middleware handles everything else)
 */
async function handleChatRequest(
  req: VercelRequest & { validated: ChatRequest },
  res: VercelResponse,
) {
  const requestLogger = logger.child({ endpoint: "/v1/chat" })
  const prompt = req.validated.text.trim()

  requestLogger.info("Processing chat request", {
    promptLength: prompt.length,
    hasText: !!req.validated.text,
  })

  // Get Anthropic configuration
  const { apiKey, model } = getAnthropicConfig()

  // Forward request to Anthropic's API
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  // Handle upstream API errors
  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => upstream.statusText)
    requestLogger.error("Anthropic API error", {
      status: upstream.status,
      statusText: upstream.statusText,
      error: errorText,
    })

    // Return appropriate error based on status code
    if (upstream.status === 401) {
      return sendError(res, {
        code: "UPSTREAM_AUTH_ERROR",
        message: "Invalid API key",
        status: 502,
      })
    } else if (upstream.status === 429) {
      return sendError(res, { code: "RATE_LIMITED", message: "Rate limit exceeded", status: 429 })
    } else if (upstream.status >= 500) {
      return sendError(res, {
        code: "UPSTREAM_ERROR",
        message: "Anthropic service unavailable",
        status: 502,
      })
    } else {
      return sendError(
        res,
        { code: "UPSTREAM_ERROR", message: "Upstream error", status: 502 },
        { detail: errorText },
      )
    }
  }

  // Parse the response from Anthropic's API
  const data = (await upstream.json()) as {
    content?: Array<{ type: string; text?: string }>
  }

  // Extract the text content from the response
  const reply = Array.isArray(data.content)
    ? (data.content.find((c) => c.type === "text")?.text ?? "")
    : ""

  // Validate response data against schema
  const validatedResponse = validateChatResponse({ reply })

  requestLogger.info("Chat request completed successfully", {
    replyLength: validatedResponse.reply.length,
    hasReply: !!validatedResponse.reply,
  })

  return sendSuccess(res, validatedResponse)
}

/**
 * Composed handler with all middleware
 */
const handler = compose(
  withRequestLogging,
  withErrorHandling,
  withRateLimit(RateLimits.STRICT), // 10 requests/minute for AI endpoints
  withMethods(["POST"]),
  withValidation(validateChatRequest, "body"),
)(handleChatRequest)

/**
 * Middleware composition helper
 */
function compose(...middlewares: any[]) {
  return middlewares.reduce(
    (a, b) =>
      (...args: any[]) =>
        a(b(...args)),
  )
}

export default handler
