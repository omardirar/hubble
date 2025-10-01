/**
 * Generate Conversation Title API Route
 *
 * Uses AI to generate a concise, meaningful title based on the first message.
 */

import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { getAnthropicConfig } from "@hubble/config"
import { createApiHandler } from "@hubble/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  return createApiHandler(
    async (request, auth, logger) => {
      const body = await req.json()
      const { message } = body as { message: string }

      if (!message || message.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Message is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      try {
        const { model } = getAnthropicConfig()

        const { text: title } = await generateText({
          model: anthropic(model || "claude-3-5-sonnet-20241022"),
          system:
            "You are a title generator. Generate a concise, descriptive title (3-5 words max) for a conversation based on the user's first message. Only return the title, nothing else. No quotes, no punctuation at the end.",
          prompt: `Generate a short title for this message: "${message.slice(0, 200)}"`,
        })

        // Clean up the title (remove quotes, trim, limit length)
        const cleanTitle = title
          .replace(/^["']|["']$/g, "") // Remove quotes
          .trim()
          .slice(0, 50) // Max 50 chars

        logger.info("Generated conversation title", {
          userId: auth!.userId,
          orgId: auth!.orgId,
          messagePreview: message.slice(0, 50),
          generatedTitle: cleanTitle,
        })

        return new Response(JSON.stringify({ title: cleanTitle }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        logger.error("Failed to generate title", {
          error: error instanceof Error ? error.message : String(error),
          userId: auth!.userId,
          orgId: auth!.orgId,
        })

        // Fallback to a simple title if AI generation fails
        const fallbackTitle = message.slice(0, 30) + (message.length > 30 ? "..." : "")

        return new Response(JSON.stringify({ title: fallbackTitle }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      loggerContext: { endpoint: "/api/v1/chat/generate-title" },
    },
  )(req)
}
