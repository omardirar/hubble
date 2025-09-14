/**
 * AI Chat API Function for Vercel
 *
 * This function processes chat requests by forwarding them to the Anthropic API
 *
 * Flow:
 * 1. Parse and validate the incoming request
 * 2. Retrieve Anthropic API credentials from environment variables
 * 3. Forward the request to Anthropic's API
 * 4. Process and format the response
 * 5. Return the AI-generated reply
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import {
  type ChatRequest,
  type ChatResponse,
  validateChatRequest,
  validateChatResponse,
} from "@hubble/api-contracts/chat"

/**
 * Get Anthropic configuration from environment variables
 */
function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable")
  }

  return { apiKey, model }
}

/**
 * Handle chat requests
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Parse and validate the request body
    let validatedRequest: ChatRequest
    try {
      validatedRequest = validateChatRequest(req.body)
    } catch (validationError) {
      console.warn("Invalid chat request:", validationError)
      return res.status(400).json({ error: "Invalid request data" })
    }

    const prompt = validatedRequest.text.trim()

    // Log the incoming request for debugging (without sensitive data)
    console.log("Processing chat request", {
      promptLength: prompt.length,
      hasText: !!validatedRequest.text,
    })

    // Retrieve Anthropic API credentials from environment variables
    const { apiKey, model } = getAnthropicConfig()

    // Forward the request to Anthropic's API
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
      console.error("Anthropic API error", {
        status: upstream.status,
        statusText: upstream.statusText,
        error: errorText,
      })

      // Return appropriate error based on status code
      if (upstream.status === 401) {
        return res.status(502).json({ error: "Invalid API key" })
      } else if (upstream.status === 429) {
        return res.status(429).json({ error: "Rate limit exceeded" })
      } else if (upstream.status >= 500) {
        return res.status(502).json({ error: "Anthropic service unavailable" })
      } else {
        return res.status(502).json({ error: "Upstream error", detail: errorText })
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
      return res.status(500).json({ error: "Response validation failed" })
    }

    // Log successful response
    console.log("Chat request completed successfully", {
      replyLength: validatedResponse.reply.length,
      hasReply: !!validatedResponse.reply,
    })

    // Return the AI-generated reply
    return res.status(200).json(validatedResponse)
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
      return res.status(502).json({ error: "Upstream not configured" })
    }

    // Special handling for network errors
    if (msg.includes("fetch failed") || msg.includes("ETIMEDOUT")) {
      return res.status(502).json({ error: "Network error" })
    }

    // Generic error handling for unexpected issues
    return res.status(500).json({ error: "Unexpected error", detail: msg })
  }
}
