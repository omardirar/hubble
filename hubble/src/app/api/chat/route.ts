import { NextRequest } from "next/server"
import { streamText, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"

export async function POST(req: NextRequest) {
  const { messages = [] } = await req.json().catch(() => ({ messages: [] }))

  const result = streamText({
    model: anthropic("claude-3-5-sonnet-latest"),
    messages: convertToModelMessages(messages),
    system: "You are a helpful assistant.",
    experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
      },
  })

  return result.toUIMessageStreamResponse()
}


