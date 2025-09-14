/**
 * AI Chat API Route Handler
 *
 * This handler processes chat requests by forwarding them to the Anthropic API
 * for AI-powered responses. It handles the complete flow from request parsing
 * to response formatting.
 *
 * Flow:
 * 1. Parse and validate the incoming request
 * 2. Retrieve Anthropic API credentials from Secrets Store
 * 3. Forward the request to Anthropic's API
 * 4. Process and format the response
 * 5. Return the AI-generated reply
 *
 * Security:
 * - API key retrieved securely from Cloudflare Secrets Store
 * - No sensitive data exposed in error messages
 * - Proper error handling for upstream failures
 */

import { getAnthropicEnvFromSecrets, type SecretsStoreEnv } from "@hubble/env"
import {
  type ChatRequest,
  type ChatResponse,
  validateChatRequest,
  validateChatResponse,
} from "@hubble/api-contracts/chat"

/**
 * Handle chat requests by forwarding them to Anthropic's API
 *
 * @param request - The incoming HTTP request containing chat text
 * @param env - Cloudflare Workers environment with Secrets Store bindings
 * @returns Promise that resolves to an HTTP response with the AI reply
 */
export async function handleChat(request: Request, env: SecretsStoreEnv): Promise<Response> {
  try {
    // Parse and validate the request body
    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.warn("Invalid JSON in chat request")
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Validate request body against schema
    let validatedRequest: ChatRequest
    try {
      validatedRequest = validateChatRequest(body)
    } catch (validationError) {
      console.warn("Invalid chat request:", validationError)
      return Response.json({ error: "Invalid request data" }, { status: 400 })
    }

    const prompt = validatedRequest.text.trim()

    // Log the incoming request for debugging (without sensitive data)
    console.log("Processing chat request", {
      promptLength: prompt.length,
      hasText: !!validatedRequest.text,
    })

    // Retrieve Anthropic API credentials from Cloudflare Secrets Store
    const { apiKey, model } = await getAnthropicEnvFromSecrets(env)

    // Forward the request to Anthropic's API
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey, // API key from Secrets Store
        "anthropic-version": "2023-06-01", // API version
      },
      body: JSON.stringify({
        model, // AI model (e.g., claude-3-5-sonnet-latest)
        max_tokens: 1024, // Maximum response length
        messages: [{ role: "user", content: prompt }], // User's message
      }),
    })

    // Handle upstream API errors
    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => upstream.statusText)
      console.error("Anthropic API error", {
        status: upstream.status,
        statusText: upstream.statusText,
        error: errorText,
      })

      // Return appropriate error based on status code
      if (upstream.status === 401) {
        return Response.json({ error: "Invalid API key" }, { status: 502 })
      } else if (upstream.status === 429) {
        return Response.json({ error: "Rate limit exceeded" }, { status: 429 })
      } else if (upstream.status >= 500) {
        return Response.json({ error: "Anthropic service unavailable" }, { status: 502 })
      } else {
        return Response.json({ error: "Upstream error", detail: errorText }, { status: 502 })
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
    let validatedResponse: ChatResponse
    try {
      validatedResponse = validateChatResponse({ reply })
    } catch (validationError) {
      console.error("Response validation error:", validationError)
      return Response.json({ error: "Response validation failed" }, { status: 500 })
    }

    // Log successful response
    console.log("Chat request completed successfully", {
      replyLength: validatedResponse.reply.length,
      hasReply: !!validatedResponse.reply,
    })

    // Return the AI-generated reply
    return Response.json(validatedResponse)
  } catch (err) {
    // Handle errors gracefully with appropriate status codes
    const msg = err instanceof Error ? err.message : String(err)

    // Log the error for debugging
    console.error("Chat request failed", {
      error: msg,
      stack: err instanceof Error ? err.stack : undefined,
    })

    // Special handling for missing API key (configuration issue)
    if (msg.includes("Missing ANTHROPIC_API_KEY")) {
      return Response.json({ error: "Upstream not configured" }, { status: 502 })
    }

    // Special handling for network errors
    if (msg.includes("fetch failed") || msg.includes("ETIMEDOUT")) {
      return Response.json({ error: "Network error" }, { status: 502 })
    }

    // Generic error handling for unexpected issues
    return Response.json({ error: "Unexpected error", detail: msg }, { status: 500 })
  }
}
