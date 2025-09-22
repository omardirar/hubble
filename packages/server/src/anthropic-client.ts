/**
 * Anthropic API Client
 *
 * This module provides a clean interface for interacting with the Anthropic API
 * with proper error handling and response validation.
 */

import { getAnthropicConfig } from "@hubble/config"
import { logger } from "@hubble/logger"
import { handleUpstreamError } from "./api-handlers"

type Logger = ReturnType<typeof logger.child>

export interface AnthropicMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface AnthropicRequest {
  messages: AnthropicMessage[]
  max_tokens?: number
  model?: string
}

export interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>
}

/**
 * Send a request to the Anthropic API
 */
export async function sendToAnthropic(
  request: AnthropicRequest,
  requestLogger: Logger,
): Promise<AnthropicResponse> {
  const { apiKey, model } = getAnthropicConfig()

  requestLogger.info("Sending request to Anthropic", {
    messageCount: request.messages.length,
    model: request.model || model,
  })

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: request.model || model,
      max_tokens: request.max_tokens || 1024,
      messages: request.messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as AnthropicResponse
  requestLogger.info("Received response from Anthropic", {
    contentLength: data.content?.length || 0,
  })

  return data
}

/**
 * Extract text content from Anthropic response
 */
export function extractTextFromResponse(response: AnthropicResponse): string {
  return Array.isArray(response.content)
    ? (response.content.find((c) => c.type === "text")?.text ?? "")
    : ""
}

/**
 * Send a simple chat message to Anthropic and get the text response
 */
export async function chatWithAnthropic(prompt: string, requestLogger: Logger): Promise<string> {
  const response = await sendToAnthropic(
    {
      messages: [{ role: "user", content: prompt }],
    },
    requestLogger,
  )

  return extractTextFromResponse(response)
}
