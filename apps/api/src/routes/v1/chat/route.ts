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

/**
 * Handle chat requests by forwarding them to Anthropic's API
 *
 * @param request - The incoming HTTP request containing chat text
 * @param env - Cloudflare Workers environment with Secrets Store bindings
 * @returns Promise that resolves to an HTTP response with the AI reply
 */
export async function handleChat(request: Request, env: SecretsStoreEnv): Promise<Response> {
  try {
    // Parse the request body and extract the text input
    const { text } = (await request.json().catch(() => ({}))) as { text?: string }
    const prompt = (text ?? "").trim()

    // Validate that we have a non-empty prompt
    if (!prompt) {
      return Response.json({ error: "Missing text" }, { status: 400 })
    }

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
      const msg = await upstream.text().catch(() => upstream.statusText)
      return Response.json({ error: "Upstream error", detail: msg }, { status: 502 })
    }

    // Parse the response from Anthropic's API
    const data = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>
    }

    // Extract the text content from the response
    const reply = Array.isArray(data.content)
      ? (data.content.find((c) => c.type === "text")?.text ?? "")
      : ""

    // Return the AI-generated reply
    return Response.json({ reply })
  } catch (err) {
    // Handle errors gracefully with appropriate status codes
    const msg = err instanceof Error ? err.message : String(err)

    // Special handling for missing API key (configuration issue)
    if (msg.includes("Missing ANTHROPIC_API_KEY")) {
      return Response.json({ error: "Upstream not configured" }, { status: 502 })
    }

    // Generic error handling for unexpected issues
    return Response.json({ error: "Unexpected error", detail: msg }, { status: 500 })
  }
}
