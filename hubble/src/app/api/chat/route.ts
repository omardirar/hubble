import { NextRequest } from "next/server"
import { streamText, convertToCoreMessages, stepCountIs } from "ai"
import { dynamicTool, jsonSchema } from "@ai-sdk/provider-utils"
import type { UIMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { auth } from "@clerk/nextjs/server"
import { resolveDbForOrg } from "@/lib/tenant"
import { signDbJwtRS256 } from "@/lib/jwt"
import { randomUUID } from "crypto"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const startMs = Date.now()
  const traceId = randomUUID()

  const rawBody: unknown = await req.json().catch(() => ({}))
  let messages: UIMessage[] = []
  let clientHint: string | undefined
  if (rawBody && typeof rawBody === "object") {
    const rb = rawBody as Record<string, unknown>
    if (Array.isArray(rb.messages)) messages = rb.messages as UIMessage[]
    if (typeof rb.db === "string") clientHint = rb.db
  }

  const { userId, orgId } = await auth()
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!orgId) {
    return Response.json({ error: "Organization required" }, { status: 403 })
  }

  let dbName: string
  try {
    dbName = await resolveDbForOrg(orgId, clientHint)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(
      JSON.stringify({ traceId, userId, orgId, event: "db_resolve_error", msg })
    )
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const mcpUrl = process.env.MCP_MOTHERDUCK_URL
  if (!mcpUrl) {
    console.error(JSON.stringify({ traceId, userId, orgId, db: dbName, event: "missing_mcp_url" }))
    return Response.json({ error: "Bad Gateway" }, { status: 502 })
  }

  try {
    const jwt = await signDbJwtRS256({ sub: userId, db: dbName })

    // Derive Origin for servers that enforce origin checks
    const hdrs = req.headers
    const xfProto = hdrs.get("x-forwarded-proto") || "https"
    const xfHost = hdrs.get("x-forwarded-host") || hdrs.get("host") || ""
    const originHeader = hdrs.get("origin") || (xfHost ? `${xfProto}://${xfHost}` : undefined)

    const mcpClient = new Client({ name: "hubble-chat", version: "1.0.0" }, { capabilities: {} as import("@modelcontextprotocol/sdk/types.js").ClientCapabilities })
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: {
        // Ensure Streamable HTTP has required headers per spec
        headers: {
          Authorization: `Bearer ${jwt}`,
          "X-Db-Name": dbName,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(originHeader ? { Origin: originHeader } : {}),
        },
      },
    })
    await mcpClient.connect(transport)

    const list = await mcpClient.listTools()
    const tools = Object.fromEntries(
      (list.tools ?? []).map((t) => {
        const tName = t.name
        const tDesc = t.description || ""
        const tTool = dynamicTool({
          description: tDesc,
          inputSchema: jsonSchema(
            (t as { inputSchema?: unknown })?.inputSchema ?? { type: "object", properties: {}, required: [] }
          ),
          execute: async (args: unknown) => {
            const safeArgs: Record<string, unknown> = args && typeof args === "object" ? (args as Record<string, unknown>) : {}
            const result = await mcpClient.callTool({ name: tName, arguments: safeArgs })
            // Flatten common MCP text results; fall back to raw result
            const texts: string[] = []
            const contentArray = (result as { content?: unknown })?.content
            if (Array.isArray(contentArray)) {
              for (const c of contentArray as Array<unknown>) {
                if (
                  c &&
                  typeof c === "object" &&
                  "type" in c &&
                  (c as { type?: unknown }).type === "text" &&
                  "text" in c &&
                  typeof (c as { text?: unknown }).text === "string"
                ) {
                  texts.push((c as { text: string }).text)
                }
              }
            }
            return texts.length > 0 ? texts.join("\n\n") : result
          },
        })
        return [tName, tTool]
      })
    )

    const result = streamText({
      model: anthropic(process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"),
      messages: convertToCoreMessages(messages),
      system:
        "You are a helpful assistant with read-only access to a MotherDuck database. Use only SELECT queries, apply tight LIMITs, and avoid full scans. Explain your steps briefly.",
      stopWhen: stepCountIs(10),
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
      },
      tools,
    })

    console.info(
      JSON.stringify({
        traceId,
        userId,
        orgId,
        db: dbName,
        event: "chat_stream_started",
        latencyMs: Date.now() - startMs,
      })
    )

    return result.toUIMessageStreamResponse()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(
      JSON.stringify({
        traceId,
        userId,
        orgId,
        db: dbName,
        event: "upstream_error",
        type: err instanceof Error ? err.name : "UnknownError",
        msg: errMsg,
      })
    )

    const result = streamText({
      model: anthropic(process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"),
      messages: [
        {
          role: "user",
          content:
            "Please provide a brief, user-friendly error message explaining that the data tools are temporarily unavailable. Do not include technical details. Keep it under 2 sentences.",
        },
      ],
      system:
        "Output a short, safe error apology indicating the data tools are temporarily unavailable. Do not reveal internal details. Keep under 2 sentences.",
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
      },
    })

    return result.toUIMessageStreamResponse({ status: 502 })
  }
}


