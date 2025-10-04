/**
 * MCP Client Utilities
 *
 * Provides helpers for connecting to MCP servers and converting their
 * tool definitions into AI SDK compatible tool sets.
 */

import { Client } from "@modelcontextprotocol/sdk/client"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { dynamicTool, jsonSchema, type ToolSet } from "ai"

type StructuredLogger = {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

export interface McpConnectionOptions {
  url: string
  headers: Record<string, string>
  logger?: StructuredLogger
  clientName?: string
  clientVersion?: string
}

export interface McpConnection {
  client: Client
  tools: Record<string, unknown>
  instructions?: string
}

/**
 * Establishes an MCP connection over SSE and returns the connected client with
 * its tool set converted for the AI SDK.
 */
export async function connectMcp(options: McpConnectionOptions): Promise<McpConnection> {
  const {
    url,
    headers,
    logger,
    clientName = "hubble-mcp-client",
    clientVersion = "1.0.0",
  } = options

  const requestHeaders = { "content-type": "application/json", ...headers }

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: requestHeaders },
  })

  transport.onerror = (error: Error) => {
    logger?.warn("mcp.transport_error", {
      error: error.message,
    })
  }

  const client = new Client({ name: clientName, version: clientVersion })
  await client.connect(transport)

  const { tools: serverTools } = await client.listTools()
  const tools = buildToolSet(client, serverTools)

  return {
    client,
    tools,
    instructions: client.getInstructions(),
  }
}

type RemoteTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number]
type CallToolResult = Awaited<ReturnType<Client["callTool"]>>

function buildToolSet(client: Client, serverTools: RemoteTool[]): ToolSet {
  const toolSet: ToolSet = {}

  for (const tool of serverTools) {
    const toolInputSchema = (tool.inputSchema ?? {
      type: "object",
      properties: {},
    }) as Parameters<typeof jsonSchema>[0]

    const toolImplementation = dynamicTool({
      description: tool.description ?? undefined,
      inputSchema: jsonSchema(toolInputSchema),
      async execute(
        input: unknown,
        options: { abortSignal?: AbortSignal } = {},
      ): Promise<CallToolResult> {
        const signal = options.abortSignal
        if (signal?.aborted) {
          throw createAbortError()
        }

        return client.callTool(
          {
            name: tool.name,
            arguments: input as Record<string, unknown> | undefined,
          },
          undefined,
          signal ? { signal } : undefined,
        )
      },
    })

    toolSet[tool.name] = toolImplementation as ToolSet[string]
  }

  return toolSet
}

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("The operation was aborted", "AbortError")
  }
  const error = new Error("The operation was aborted")
  error.name = "AbortError"
  return error
}
