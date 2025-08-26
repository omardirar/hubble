import { NextRequest } from "next/server"
import { streamText, convertToModelMessages, experimental_createMCPClient } from "ai"
import type { ToolSet } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio"
import path from "node:path"

let mcpToolsPromise: Promise<ToolSet> | null = null

async function getMcpTools() {
  if (!mcpToolsPromise) {
    const transport = new Experimental_StdioMCPTransport({
      command: "node",
      args: [path.resolve(process.cwd(), "mcp/test/build/index.js")],
    })
    const client = await experimental_createMCPClient({ transport })
    mcpToolsPromise = client.tools()
  }
  return mcpToolsPromise
}

export async function POST(req: NextRequest) {
  const { messages = [] } = await req.json().catch(() => ({ messages: [] }))

  const tools = await getMcpTools()

  const result = streamText({
    model: anthropic("claude-3-5-sonnet-latest"),
    messages: convertToModelMessages(messages),
    system: "You are a helpful assistant.",
    tools,
    experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
      },
  })

  return result.toUIMessageStreamResponse()
}


